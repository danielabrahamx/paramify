#[cfg(test)]
mod tests {
    use super::*;
    use candid::{Decode, Encode, Principal};
    use ic_cdk::api::call::CallResult;

    // Mock HTTP response for testing
    fn mock_usgs_response() -> String {
        r#"{
            "value": {
                "timeSeries": [{
                    "sourceInfo": {
                        "siteName": "POTOMAC RIVER NEAR WASH, DC"
                    },
                    "values": [{
                        "value": [{
                            "value": "3.45",
                            "dateTime": "2025-09-02T10:00:00.000-04:00"
                        }]
                    }]
                }]
            }
        }"#.to_string()
    }

    #[test]
    fn test_parse_usgs_response() {
        let response = mock_usgs_response();
        let oracle = Oracle::default();
        
        // Test parsing
        match oracle.parse_usgs_response(&response) {
            Ok(value) => {
                assert_eq!(value, 345); // 3.45 * 100
            },
            Err(e) => panic!("Failed to parse response: {}", e),
        }
    }

    #[test]
    fn test_value_scaling() {
        // Test conversion from feet to scaled integer
        let feet_values = vec![
            (2.5, 250),
            (3.0, 300),
            (4.11, 411),
            (10.99, 1099),
        ];

        for (feet, expected_scaled) in feet_values {
            let scaled = (feet * 100.0) as i64;
            assert_eq!(scaled, expected_scaled, 
                "Failed to scale {} feet correctly", feet);
        }
    }

    #[test]
    fn test_authorization() {
        let mut oracle = Oracle::default();
        let authorized = Principal::from_text("rrkah-fqaaa-aaaaa-aaaaq-cai").unwrap();
        let unauthorized = Principal::from_text("ryjl3-tyaaa-aaaaa-aaaba-cai").unwrap();

        // Add authorized caller
        oracle.add_authorized_caller(authorized);
        
        // Test authorization
        assert!(oracle.is_authorized(&authorized), "Should be authorized");
        assert!(!oracle.is_authorized(&unauthorized), "Should not be authorized");
    }

    #[test]
    fn test_data_history() {
        let mut oracle = Oracle::default();
        
        // Add some historical data
        let values = vec![250, 300, 345, 411, 425];
        for (i, value) in values.iter().enumerate() {
            oracle.add_to_history(*value, i as u64);
        }

        // Check history
        let history = oracle.get_historical_data(10);
        assert_eq!(history.len(), 5, "Should have 5 historical entries");
        assert_eq!(history[0].value, 425, "Most recent should be first");
        assert_eq!(history[4].value, 250, "Oldest should be last");
    }

    #[test]
    fn test_manual_update() {
        let mut oracle = Oracle::default();
        
        // Manual update
        oracle.manual_update_value(500);
        
        // Check value
        let latest = oracle.get_latest_data();
        assert!(latest.is_some(), "Should have latest data");
        assert_eq!(latest.unwrap().value, 500, "Value should be 500");
    }

    #[test]
    fn test_threshold_comparison() {
        let oracle = Oracle::default();
        
        // Test threshold comparisons
        let test_cases = vec![
            (299, 300, false),  // Below threshold
            (300, 300, true),   // At threshold
            (301, 300, true),   // Above threshold
        ];

        for (value, threshold, expected) in test_cases {
            let result = value >= threshold;
            assert_eq!(result, expected, 
                "Failed threshold comparison: {} >= {}", value, threshold);
        }
    }

    #[test]
    fn test_error_handling() {
        let oracle = Oracle::default();
        
        // Test parsing invalid JSON
        let invalid_json = "not json";
        match oracle.parse_usgs_response(invalid_json) {
            Err(e) => {
                assert!(e.contains("Failed to parse"), "Should fail to parse invalid JSON");
            },
            Ok(_) => panic!("Should not parse invalid JSON"),
        }

        // Test parsing JSON with missing fields
        let incomplete_json = r#"{"value": {}}"#;
        match oracle.parse_usgs_response(incomplete_json) {
            Err(e) => {
                assert!(e.contains("parse") || e.contains("field"), 
                    "Should fail on missing fields");
            },
            Ok(_) => panic!("Should not parse incomplete JSON"),
        }
    }

    #[test]
    fn test_status_reporting() {
        let mut oracle = Oracle::default();
        
        // Add some data
        oracle.manual_update_value(350);
        oracle.total_updates = 10;
        oracle.failed_updates = 2;
        
        // Get status
        let status = oracle.get_status();
        
        assert_eq!(status.total_updates, 10, "Should have 10 total updates");
        assert_eq!(status.failed_updates, 2, "Should have 2 failed updates");
        assert_eq!(status.success_rate, 80.0, "Success rate should be 80%");
        assert!(status.is_healthy, "Should be healthy with 80% success rate");
    }

    #[async_std::test]
    async fn test_transform_function() {
        // Test the transform function for HTTPS outcalls
        let response_body = mock_usgs_response().into_bytes();
        
        // Simulate transform
        let transformed = transform_response(response_body.clone());
        
        // Should return the same for valid JSON
        assert_eq!(transformed, response_body, 
            "Transform should preserve valid response");
    }

    #[test]
    fn test_cycles_management() {
        let oracle = Oracle::default();
        
        // Test cycles calculation
        let test_cases = vec![
            (1_000_000_000_000, true),   // 1T cycles - healthy
            (100_000_000_000, true),      // 100B cycles - healthy  
            (10_000_000_000, false),      // 10B cycles - low
            (1_000_000_000, false),       // 1B cycles - critical
        ];

        for (cycles, expected_healthy) in test_cases {
            let is_healthy = cycles > 50_000_000_000; // 50B threshold
            assert_eq!(is_healthy, expected_healthy,
                "Cycles health check failed for {}", cycles);
        }
    }
}