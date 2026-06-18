-- pgTAP: portable H3 index helpers (hex parse, parent, SR matching resolution).

begin;

select plan(5);

select is(
  public.matching_h3_hex_to_bigint('89a91b46253ffff'),
  619968102646677503::bigint,
  'parses h3-js hex to uint64 bigint'
);

select is(
  public.matching_h3_bigint_to_hex(619968102646677503::bigint),
  '89a91b46253ffff',
  'formats uint64 bigint back to h3-js hex'
);

select is(
  public.matching_h3_parse_index('610960903403208703'),
  610960903403208703::bigint,
  'parses decimal bigint text'
);

select is(
  public.matching_h3_cell_to_parent(
    public.matching_h3_hex_to_bigint('89a91b46253ffff'),
    7
  ),
  610960903403208703::bigint,
  'derives res-7 parent from res-9 hex cell'
);

select is(
  public.matching_h3_cell_at_matching_resolution(
    '89a91b46253ffff',
    ST_SetSRID(ST_MakePoint(-48.5482, -27.5954), 4326)::extensions.geography
  ),
  610960903403208703::bigint,
  'derives matching-resolution cell from address hex'
);

select * from finish();
rollback;
