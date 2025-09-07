import Principal "mo:base/Principal";
import HashMap "mo:base/HashMap";
import Result "mo:base/Result";
import Time "mo:base/Time";
import Text "mo:base/Text";
import Array "mo:base/Array";
import Iter "mo:base/Iter";

persistent actor FloodDataStorage {
    type FloodData = {
        level: Float;
        timestamp: Int;
        stationId: Text;
    };

    type Error = {
        #NotFound;
        #InvalidData;
        #Unauthorized;
    };

    private stable var floodDataEntries: [(Text, FloodData)] = [];
    private transient var floodData = HashMap.fromIter<Text, FloodData>(floodDataEntries.vals(), floodDataEntries.size(), Text.equal, Text.hash);
    private stable var admin: ?Principal = null;

    system func preupgrade() {
        floodDataEntries := Iter.toArray(floodData.entries());
    };

    system func postupgrade() {
        floodDataEntries := [];
    };

    public func setAdmin(principal: Principal) : async () {
        admin := ?principal;
    };

    public func storeFloodData(stationId: Text, level: Float) : async Result.Result<(), Error> {
        let data: FloodData = {
            level = level;
            timestamp = Time.now();
            stationId = stationId;
        };
        floodData.put(stationId, data);
        #ok(())
    };

    public query func getFloodData(stationId: Text) : async Result.Result<FloodData, Error> {
        switch (floodData.get(stationId)) {
            case (?data) { #ok(data) };
            case null { #err(#NotFound) };
        }
    };

    public query func getAllFloodData() : async [(Text, FloodData)] {
        let buffer = Array.init<(Text, FloodData)>(floodData.size(), ("", { level = 0.0; timestamp = 0; stationId = "" }));
        var i = 0;
        for ((key, value) in floodData.entries()) {
            buffer[i] := (key, value);
            i += 1;
        };
        Array.freeze(buffer)
    };

    public func clearData() : async () {
        floodData := HashMap.HashMap<Text, FloodData>(0, Text.equal, Text.hash);
    };
}