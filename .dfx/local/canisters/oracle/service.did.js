export const idlFactory = ({ IDL }) => {
  const InitArgs = IDL.Record({
    'update_interval_seconds' : IDL.Opt(IDL.Nat64),
    'authorized_principals' : IDL.Opt(IDL.Vec(IDL.Principal)),
  });
  const FloodData = IDL.Record({
    'water_level_feet' : IDL.Float64,
    'source' : IDL.Text,
    'site_name' : IDL.Text,
    'timestamp' : IDL.Nat64,
    'location' : IDL.Text,
  });
  const CachedData = IDL.Record({
    'data' : FloodData,
    'cached_at' : IDL.Nat64,
  });
  const OracleConfig = IDL.Record({
    'update_interval_seconds' : IDL.Nat64,
    'authorized_principals' : IDL.Vec(IDL.Principal),
    'is_paused' : IDL.Bool,
    'max_retries' : IDL.Nat32,
    'usgs_base_url' : IDL.Text,
  });
  const OracleStatus = IDL.Record({
    'last_error' : IDL.Opt(IDL.Text),
    'total_updates' : IDL.Nat64,
    'last_update_time' : IDL.Opt(IDL.Nat64),
    'update_interval_seconds' : IDL.Nat64,
    'cached_locations' : IDL.Vec(IDL.Text),
    'is_paused' : IDL.Bool,
  });
  const HttpResponse = IDL.Record({
    'status' : IDL.Nat,
    'body' : IDL.Vec(IDL.Nat8),
    'headers' : IDL.Vec(IDL.Tuple(IDL.Text, IDL.Text)),
  });
  const TransformArgs = IDL.Record({
    'context' : IDL.Vec(IDL.Nat8),
    'response' : HttpResponse,
  });
  return IDL.Service({
    'add_authorized_principal' : IDL.Func(
        [IDL.Principal],
        [IDL.Variant({ 'Ok' : IDL.Text, 'Err' : IDL.Text })],
        [],
      ),
    'batch_update' : IDL.Func(
        [IDL.Vec(IDL.Text)],
        [
          IDL.Vec(
            IDL.Tuple(
              IDL.Text,
              IDL.Variant({ 'Ok' : FloodData, 'Err' : IDL.Text }),
            )
          ),
        ],
        [],
      ),
    'clear_cache' : IDL.Func(
        [],
        [IDL.Variant({ 'Ok' : IDL.Text, 'Err' : IDL.Text })],
        [],
      ),
    'get_all_cached_locations' : IDL.Func([], [IDL.Vec(IDL.Text)], ['query']),
    'get_cached_data' : IDL.Func([IDL.Text], [IDL.Opt(CachedData)], ['query']),
    'get_configuration' : IDL.Func([], [OracleConfig], ['query']),
    'get_latest_data' : IDL.Func(
        [IDL.Text],
        [IDL.Variant({ 'Ok' : FloodData, 'Err' : IDL.Text })],
        ['query'],
      ),
    'get_status' : IDL.Func([], [OracleStatus], ['query']),
    'manual_update' : IDL.Func(
        [IDL.Text],
        [IDL.Variant({ 'Ok' : FloodData, 'Err' : IDL.Text })],
        [],
      ),
    'remove_authorized_principal' : IDL.Func(
        [IDL.Principal],
        [IDL.Variant({ 'Ok' : IDL.Text, 'Err' : IDL.Text })],
        [],
      ),
    'set_paused' : IDL.Func(
        [IDL.Bool],
        [IDL.Variant({ 'Ok' : IDL.Text, 'Err' : IDL.Text })],
        [],
      ),
    'transform_usgs_response' : IDL.Func(
        [TransformArgs],
        [HttpResponse],
        ['query'],
      ),
    'update_configuration' : IDL.Func(
        [OracleConfig],
        [IDL.Variant({ 'Ok' : IDL.Text, 'Err' : IDL.Text })],
        [],
      ),
  });
};
export const init = ({ IDL }) => {
  const InitArgs = IDL.Record({
    'update_interval_seconds' : IDL.Opt(IDL.Nat64),
    'authorized_principals' : IDL.Opt(IDL.Vec(IDL.Principal)),
  });
  return [IDL.Opt(InitArgs)];
};
