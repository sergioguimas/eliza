| routine_name             | return_type      | routine_definition                                            |
| ------------------------ | ---------------- | ------------------------------------------------------------- |
| update_updated_at_column | trigger          | 
begin
    new.updated_at = now();
    return new;
end;
 |
| gbtreekey4_in            | USER-DEFINED     | null                                                          |
| gbtreekey4_out           | cstring          | null                                                          |
| gbtreekey8_in            | USER-DEFINED     | null                                                          |
| gbtreekey8_out           | cstring          | null                                                          |
| gbtreekey16_in           | USER-DEFINED     | null                                                          |
| gbtreekey16_out          | cstring          | null                                                          |
| gbtreekey32_in           | USER-DEFINED     | null                                                          |
| gbtreekey32_out          | cstring          | null                                                          |
| gbtreekey_var_in         | USER-DEFINED     | null                                                          |
| gbtreekey_var_out        | cstring          | null                                                          |
| cash_dist                | money            | null                                                          |
| date_dist                | integer          | null                                                          |
| float4_dist              | real             | null                                                          |
| float8_dist              | double precision | null                                                          |
| int2_dist                | smallint         | null                                                          |
| int4_dist                | integer          | null                                                          |
| int8_dist                | bigint           | null                                                          |
| interval_dist            | interval         | null                                                          |
| oid_dist                 | oid              | null                                                          |
| time_dist                | interval         | null                                                          |
| ts_dist                  | interval         | null                                                          |
| tstz_dist                | interval         | null                                                          |
| gbt_oid_consistent       | boolean          | null                                                          |
| gbt_oid_distance         | double precision | null                                                          |
| gbt_oid_fetch            | internal         | null                                                          |
| gbt_oid_compress         | internal         | null                                                          |
| gbt_decompress           | internal         | null                                                          |
| gbt_var_decompress       | internal         | null                                                          |
| gbt_var_fetch            | internal         | null                                                          |
| gbt_oid_penalty          | internal         | null                                                          |
| gbt_oid_picksplit        | internal         | null                                                          |
| gbt_oid_union            | USER-DEFINED     | null                                                          |
| gbt_oid_same             | internal         | null                                                          |
| gbt_int2_consistent      | boolean          | null                                                          |
| gbt_int2_distance        | double precision | null                                                          |
| gbt_int2_compress        | internal         | null                                                          |
| gbt_int2_fetch           | internal         | null                                                          |
| gbt_int2_penalty         | internal         | null                                                          |
| gbt_int2_picksplit       | internal         | null                                                          |
| gbt_int2_union           | USER-DEFINED     | null                                                          |
| gbt_int2_same            | internal         | null                                                          |
| gbt_int4_consistent      | boolean          | null                                                          |
| gbt_int4_distance        | double precision | null                                                          |
| gbt_int4_compress        | internal         | null                                                          |
| gbt_int4_fetch           | internal         | null                                                          |
| gbt_int4_penalty         | internal         | null                                                          |
| gbt_int4_picksplit       | internal         | null                                                          |
| gbt_int4_union           | USER-DEFINED     | null                                                          |
| gbt_int4_same            | internal         | null                                                          |
| gbt_int8_consistent      | boolean          | null                                                          |
| gbt_int8_distance        | double precision | null                                                          |
| gbt_int8_compress        | internal         | null                                                          |
| gbt_int8_fetch           | internal         | null                                                          |
| gbt_int8_penalty         | internal         | null                                                          |
| gbt_int8_picksplit       | internal         | null                                                          |
| gbt_int8_union           | USER-DEFINED     | null                                                          |
| gbt_int8_same            | internal         | null                                                          |
| gbt_float4_consistent    | boolean          | null                                                          |
| gbt_float4_distance      | double precision | null                                                          |
| gbt_float4_compress      | internal         | null                                                          |
| gbt_float4_fetch         | internal         | null                                                          |
| gbt_float4_penalty       | internal         | null                                                          |
| gbt_float4_picksplit     | internal         | null                                                          |
| gbt_float4_union         | USER-DEFINED     | null                                                          |
| gbt_float4_same          | internal         | null                                                          |
| gbt_float8_consistent    | boolean          | null                                                          |
| gbt_float8_distance      | double precision | null                                                          |
| gbt_float8_compress      | internal         | null                                                          |
| gbt_float8_fetch         | internal         | null                                                          |
| gbt_float8_penalty       | internal         | null                                                          |
| gbt_float8_picksplit     | internal         | null                                                          |
| gbt_float8_union         | USER-DEFINED     | null                                                          |
| gbt_float8_same          | internal         | null                                                          |
| gbt_ts_consistent        | boolean          | null                                                          |
| gbt_ts_distance          | double precision | null                                                          |
| gbt_tstz_consistent      | boolean          | null                                                          |
| gbt_tstz_distance        | double precision | null                                                          |
| gbt_ts_compress          | internal         | null                                                          |
| gbt_tstz_compress        | internal         | null                                                          |
| gbt_ts_fetch             | internal         | null                                                          |
| gbt_ts_penalty           | internal         | null                                                          |
| gbt_ts_picksplit         | internal         | null                                                          |
| gbt_ts_union             | USER-DEFINED     | null                                                          |
| gbt_ts_same              | internal         | null                                                          |
| gbt_time_consistent      | boolean          | null                                                          |
| gbt_time_distance        | double precision | null                                                          |
| gbt_timetz_consistent    | boolean          | null                                                          |
| gbt_time_compress        | internal         | null                                                          |
| gbt_timetz_compress      | internal         | null                                                          |
| gbt_time_fetch           | internal         | null                                                          |
| gbt_time_penalty         | internal         | null                                                          |
| gbt_time_picksplit       | internal         | null                                                          |
| gbt_time_union           | USER-DEFINED     | null                                                          |
| gbt_time_same            | internal         | null                                                          |
| gbt_date_consistent      | boolean          | null                                                          |
| gbt_date_distance        | double precision | null                                                          |
| gbt_date_compress        | internal         | null                                                          |
| gbt_date_fetch           | internal         | null                                                          |
| gbt_date_penalty         | internal         | null                                                          |