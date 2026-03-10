-- Remove denormalized city and neighborhood from service_requests.
-- City/neighborhood can be obtained via address_id -> client_addresses (and platform_cities for city name).

alter table public.service_requests
  drop column if exists city,
  drop column if exists neighborhood;
