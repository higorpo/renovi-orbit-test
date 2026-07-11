import { describe, expect, it } from 'vitest'
import {
  PROVIDER_JOBS_LIST_QUERY_KEY,
  providerJobsListQueryKey,
} from '../queryKeys'

describe('providerJobsListQueryKey', () => {
  it('builds a stable tuple with sort mode and coordinates', () => {
    expect(
      providerJobsListQueryKey({
        sortMode: 'nearest',
        lat: -23.5,
        lng: -46.6,
      }),
    ).toEqual([PROVIDER_JOBS_LIST_QUERY_KEY, 'nearest', -23.5, -46.6])
  })

  it('allows null coordinates for default location', () => {
    expect(
      providerJobsListQueryKey({
        sortMode: 'newest',
        lat: null,
        lng: null,
      }),
    ).toEqual([PROVIDER_JOBS_LIST_QUERY_KEY, 'newest', null, null])
  })
})
