export const idlFactory = ({ IDL }) => {
  const FloodData = IDL.Record({
    'level' : IDL.Float64,
    'stationId' : IDL.Text,
    'timestamp' : IDL.Int,
  });
  const Error = IDL.Variant({
    'NotFound' : IDL.Null,
    'InvalidData' : IDL.Null,
    'Unauthorized' : IDL.Null,
  });
  const Result_1 = IDL.Variant({ 'ok' : FloodData, 'err' : Error });
  const Result = IDL.Variant({ 'ok' : IDL.Null, 'err' : Error });
  return IDL.Service({
    'clearData' : IDL.Func([], [], []),
    'getAllFloodData' : IDL.Func(
        [],
        [IDL.Vec(IDL.Tuple(IDL.Text, FloodData))],
        ['query'],
      ),
    'getFloodData' : IDL.Func([IDL.Text], [Result_1], ['query']),
    'setAdmin' : IDL.Func([IDL.Principal], [], []),
    'storeFloodData' : IDL.Func([IDL.Text, IDL.Float64], [Result], []),
  });
};
export const init = ({ IDL }) => { return []; };
