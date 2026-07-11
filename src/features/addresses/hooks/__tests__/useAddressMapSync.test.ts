// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Dispatch, SetStateAction } from "react";
import { renderHook, act } from "@testing-library/react";
import { useAddressMapSync } from "../useAddressMapSync";
import type { GeocodingService, ReverseGeocodingResult } from "@/lib/geocoding";
import type { AddressFormData } from "../../types/addressForm.validation";
import type { AddressLocation } from "../../types/addresses.types";

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

function asSetFormData(fn: ReturnType<typeof vi.fn>): Dispatch<SetStateAction<AddressFormData>> {
  return fn as unknown as Dispatch<SetStateAction<AddressFormData>>;
}

function asSetLocation(fn: ReturnType<typeof vi.fn>): (loc: AddressLocation | null) => void {
  return fn as unknown as (loc: AddressLocation | null) => void;
}

const defaultFormData: AddressFormData = {
  address_label: "Casa",
  address_zip: "",
  address_street: "",
  address_number: "",
  address_complement: "",
  address_neighborhood_id: "",
  address_neighborhood: "",
  address_state_id: "",
  address_state: "",
  address_city_id: "",
  address_city: "",
};

function createMockGeocodingService(): GeocodingService {
  return {
    geocode: vi.fn(),
    reverseGeocode: vi.fn(),
  };
}

describe("useAddressMapSync", () => {
  let geocodingService: GeocodingService;
  let setFormDataMock: ReturnType<typeof vi.fn>;
  let setLocationMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    geocodingService = createMockGeocodingService();
    setFormDataMock = vi.fn();
    setLocationMock = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns handleMapDrag and reverseGeocoding false initially", () => {
    const { result } = renderHook(() =>
      useAddressMapSync({
        formData: defaultFormData,
        setFormData: asSetFormData(setFormDataMock),
        location: null,
        setLocation: asSetLocation(setLocationMock),
        geocodingService,
      })
    );

    expect(result.current.reverseGeocoding).toBe(false);
    expect(typeof result.current.handleMapDrag).toBe("function");
  });

  describe("handleMapDrag", () => {
    it("calls setLocation immediately with lat/lng", async () => {
      vi.mocked(geocodingService.reverseGeocode).mockResolvedValue(null);

      const { result } = renderHook(() =>
        useAddressMapSync({
          formData: defaultFormData,
          setFormData: asSetFormData(setFormDataMock),
          location: null,
          setLocation: asSetLocation(setLocationMock),
          geocodingService,
        })
      );

      await act(async () => {
        result.current.handleMapDrag(-27.5954, -48.548);
      });

      expect(setLocationMock).toHaveBeenCalledWith({
        latitude: -27.5954,
        longitude: -48.548,
      });
    });

    it("calls reverseGeocode with lat and lng", async () => {
      vi.mocked(geocodingService.reverseGeocode).mockResolvedValue(null);

      const { result } = renderHook(() =>
        useAddressMapSync({
          formData: defaultFormData,
          setFormData: asSetFormData(setFormDataMock),
          location: null,
          setLocation: asSetLocation(setLocationMock),
          geocodingService,
        })
      );

      await act(async () => {
        result.current.handleMapDrag(-27.59, -48.54);
      });

      expect(geocodingService.reverseGeocode).toHaveBeenCalledWith(-27.59, -48.54);
    });

    it("updates form with reverse result (street, number, zip, neighborhood)", async () => {
      vi.mocked(geocodingService.reverseGeocode).mockResolvedValue({
        latitude: -27.59,
        longitude: -48.54,
        street: "Rua Nova",
        number: "200",
        postalCode: "88015100",
        neighborhood: "Centro",
      });

      const { result } = renderHook(() =>
        useAddressMapSync({
          formData: defaultFormData,
          setFormData: asSetFormData(setFormDataMock),
          location: null,
          setLocation: asSetLocation(setLocationMock),
          geocodingService,
        })
      );

      await act(async () => {
        result.current.handleMapDrag(-27.59, -48.54);
      });

      expect(setFormDataMock).toHaveBeenCalledWith(expect.any(Function));
      const updater = setFormDataMock.mock.calls[0][0];
      const next = updater(defaultFormData);
      expect(next.address_street).toBe("Rua Nova");
      expect(next.address_number).toBe("200");
      expect(next.address_zip).toBe("88015-100");
      expect(next.address_neighborhood).toBe("Centro");
      expect(next.address_neighborhood_id).toBe("");
    });

    it("keeps previous form values when reverse result has no street/number", async () => {
      const prevForm: AddressFormData = {
        ...defaultFormData,
        address_street: "Rua Antiga",
        address_number: "50",
        address_zip: "01310-100",
      };
      vi.mocked(geocodingService.reverseGeocode).mockResolvedValue({
        latitude: -27.59,
        longitude: -48.54,
        city: "Florianópolis",
      });

      const { result } = renderHook(() =>
        useAddressMapSync({
          formData: prevForm,
          setFormData: asSetFormData(setFormDataMock),
          location: null,
          setLocation: asSetLocation(setLocationMock),
          geocodingService,
        })
      );

      await act(async () => {
        result.current.handleMapDrag(-27.59, -48.54);
      });

      const updater = setFormDataMock.mock.calls[0][0];
      const next = updater(prevForm);
      expect(next.address_street).toBe("Rua Antiga");
      expect(next.address_number).toBe("50");
      expect(next.address_zip).toBe("01310-100");
    });

    it("sets reverseGeocoding true then false", async () => {
      let resolveReverse: (value: ReverseGeocodingResult | null) => void;
      const reversePromise = new Promise<ReverseGeocodingResult | null>((r) => {
        resolveReverse = r;
      });
      vi.mocked(geocodingService.reverseGeocode).mockReturnValue(reversePromise);

      const { result } = renderHook(() =>
        useAddressMapSync({
          formData: defaultFormData,
          setFormData: asSetFormData(setFormDataMock),
          location: null,
          setLocation: asSetLocation(setLocationMock),
          geocodingService,
        })
      );

      expect(result.current.reverseGeocoding).toBe(false);

      let dragPromise: Promise<void>;
      await act(async () => {
        dragPromise = result.current.handleMapDrag(
          -27.59,
          -48.54
        ) as unknown as Promise<void>;
      });

      expect(result.current.reverseGeocoding).toBe(true);

      await act(async () => {
        resolveReverse!({ latitude: -27.59, longitude: -48.54 });
        await dragPromise;
      });

      expect(result.current.reverseGeocoding).toBe(false);
    });
  });

  describe("debounced geocode effect", () => {
    it("calls geocode and setLocation when form has minimal address after debounce", async () => {
      const formWithAddress: AddressFormData = {
        ...defaultFormData,
        address_street: "Rua Teste",
        address_number: "100",
        address_city: "Florianópolis",
        address_state: "SC",
        address_state_id: "s1",
        address_city_id: "c1",
        address_neighborhood: "Centro",
        address_neighborhood_id: "n1",
      };
      vi.mocked(geocodingService.geocode).mockResolvedValue({
        latitude: -27.5954,
        longitude: -48.548,
      });

      renderHook(() =>
        useAddressMapSync({
          formData: formWithAddress,
          setFormData: asSetFormData(setFormDataMock),
          location: null,
          setLocation: asSetLocation(setLocationMock),
          geocodingService,
        })
      );

      expect(geocodingService.geocode).not.toHaveBeenCalled();

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(geocodingService.geocode).toHaveBeenCalledWith(
        expect.stringMatching(/Rua Teste.*100.*Centro.*Florianópolis.*SC.*Brasil/)
      );
      expect(setLocationMock).toHaveBeenCalledWith({
        latitude: -27.5954,
        longitude: -48.548,
      });
    });

    it("does not call geocode when disabled", async () => {
      const formWithAddress: AddressFormData = {
        ...defaultFormData,
        address_street: "Rua X",
        address_number: "1",
        address_city: "Florianópolis",
        address_state: "SC",
        address_state_id: "s1",
        address_city_id: "c1",
        address_neighborhood: "Centro",
        address_neighborhood_id: "n1",
      };

      renderHook(() =>
        useAddressMapSync({
          formData: formWithAddress,
          setFormData: asSetFormData(setFormDataMock),
          location: null,
          setLocation: asSetLocation(setLocationMock),
          geocodingService,
          disabled: true,
        })
      );

      await act(async () => {
        vi.advanceTimersByTime(2000);
      });

      expect(geocodingService.geocode).not.toHaveBeenCalled();
    });

    it("does not call geocode when minimal address is missing", async () => {
      const formMissingCity: AddressFormData = {
        ...defaultFormData,
        address_street: "Rua X",
        address_number: "1",
        address_city: "",
        address_state: "SC",
      };

      renderHook(() =>
        useAddressMapSync({
          formData: formMissingCity,
          setFormData: asSetFormData(setFormDataMock),
          location: null,
          setLocation: asSetLocation(setLocationMock),
          geocodingService,
        })
      );

      await act(async () => {
        vi.advanceTimersByTime(2000);
      });

      expect(geocodingService.geocode).not.toHaveBeenCalled();
    });

    it("does not call setLocation when geocode returns null", async () => {
      const formWithAddress: AddressFormData = {
        ...defaultFormData,
        address_street: "Rua X",
        address_number: "1",
        address_city: "Florianópolis",
        address_state: "SC",
        address_state_id: "s1",
        address_city_id: "c1",
        address_neighborhood: "Centro",
        address_neighborhood_id: "n1",
      };
      vi.mocked(geocodingService.geocode).mockResolvedValue(null);

      renderHook(() =>
        useAddressMapSync({
          formData: formWithAddress,
          setFormData: asSetFormData(setFormDataMock),
          location: null,
          setLocation: asSetLocation(setLocationMock),
          geocodingService,
        })
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(geocodingService.geocode).toHaveBeenCalled();
      expect(setLocationMock).not.toHaveBeenCalled();
    });

    it("logs forward geocode failures without throwing", async () => {
      const formWithAddress: AddressFormData = {
        ...defaultFormData,
        address_street: "Rua X",
        address_number: "1",
        address_city: "Florianópolis",
        address_state: "SC",
        address_state_id: "s1",
        address_city_id: "c1",
        address_neighborhood: "Centro",
        address_neighborhood_id: "n1",
      };
      vi.mocked(geocodingService.geocode).mockRejectedValue(new Error("geocode down"));
      const { logger } = await import("@/lib/logger");

      renderHook(() =>
        useAddressMapSync({
          formData: formWithAddress,
          setFormData: asSetFormData(setFormDataMock),
          location: null,
          setLocation: asSetLocation(setLocationMock),
          geocodingService,
        })
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(logger.error).toHaveBeenCalledWith(
        "address_geocode_forward_error",
        expect.objectContaining({ error: "geocode down" }),
      );
    });
  });

  describe("triggerGeocodeNow", () => {
    it("geocodes immediately with the current form data", async () => {
      const formWithAddress: AddressFormData = {
        ...defaultFormData,
        address_street: "Rua Agora",
        address_number: "9",
        address_city: "Florianópolis",
        address_state: "SC",
        address_neighborhood: "Centro",
      };
      vi.mocked(geocodingService.geocode).mockResolvedValue({
        latitude: -27.1,
        longitude: -48.5,
      });

      const { result } = renderHook(() =>
        useAddressMapSync({
          formData: formWithAddress,
          setFormData: asSetFormData(setFormDataMock),
          location: null,
          setLocation: asSetLocation(setLocationMock),
          geocodingService,
        })
      );

      await act(async () => {
        result.current.triggerGeocodeNow();
      });

      expect(geocodingService.geocode).toHaveBeenCalledWith(
        expect.stringMatching(/Rua Agora/),
      );
      expect(setLocationMock).toHaveBeenCalledWith({
        latitude: -27.1,
        longitude: -48.5,
      });
    });

    it("no-ops when disabled or missing minimal address", async () => {
      const { result, rerender } = renderHook(
        ({
          formData,
          disabled,
        }: {
          formData: AddressFormData;
          disabled?: boolean;
        }) =>
          useAddressMapSync({
            formData,
            setFormData: asSetFormData(setFormDataMock),
            location: null,
            setLocation: asSetLocation(setLocationMock),
            geocodingService,
            disabled,
          }),
        {
          initialProps: {
            formData: defaultFormData,
            disabled: true,
          },
        },
      );

      await act(async () => {
        result.current.triggerGeocodeNow();
      });
      expect(geocodingService.geocode).not.toHaveBeenCalled();

      rerender({ formData: defaultFormData, disabled: false });
      await act(async () => {
        result.current.triggerGeocodeNow();
      });
      expect(geocodingService.geocode).not.toHaveBeenCalled();
    });

    it("skips forward geocode shortly after a map drag reverse geocode", async () => {
      vi.mocked(geocodingService.reverseGeocode).mockResolvedValue(null);
      const formWithAddress: AddressFormData = {
        ...defaultFormData,
        address_street: "Rua X",
        address_number: "1",
        address_city: "Florianópolis",
        address_state: "SC",
        address_neighborhood: "Centro",
      };

      const { result } = renderHook(() =>
        useAddressMapSync({
          formData: formWithAddress,
          setFormData: asSetFormData(setFormDataMock),
          location: null,
          setLocation: asSetLocation(setLocationMock),
          geocodingService,
        })
      );

      await act(async () => {
        await result.current.handleMapDrag(-27.59, -48.54);
      });
      vi.mocked(geocodingService.geocode).mockClear();

      await act(async () => {
        result.current.triggerGeocodeNow();
      });
      expect(geocodingService.geocode).not.toHaveBeenCalled();
    });

    it("logs non-Error forward geocode failures", async () => {
      const formWithAddress: AddressFormData = {
        ...defaultFormData,
        address_street: "Rua X",
        address_number: "1",
        address_city: "Florianópolis",
        address_state: "SC",
        address_neighborhood: "Centro",
      };
      vi.mocked(geocodingService.geocode).mockRejectedValue("down");
      const { logger } = await import("@/lib/logger");

      const { result } = renderHook(() =>
        useAddressMapSync({
          formData: formWithAddress,
          setFormData: asSetFormData(setFormDataMock),
          location: null,
          setLocation: asSetLocation(setLocationMock),
          geocodingService,
        })
      );

      await act(async () => {
        await result.current.triggerGeocodeNow();
      });

      expect(logger.error).toHaveBeenCalledWith(
        "address_geocode_forward_error",
        expect.objectContaining({ error: "down" }),
      );
    });

    it("ignores stale geocode results after a newer generation", async () => {
      let resolveFirst!: (value: { latitude: number; longitude: number } | null) => void;
      const first = new Promise<{ latitude: number; longitude: number } | null>((resolve) => {
        resolveFirst = resolve;
      });
      vi.mocked(geocodingService.geocode)
        .mockReturnValueOnce(first)
        .mockResolvedValueOnce({ latitude: -27.2, longitude: -48.2 });

      const formWithAddress: AddressFormData = {
        ...defaultFormData,
        address_street: "Rua X",
        address_number: "1",
        address_city: "Florianópolis",
        address_state: "SC",
        address_neighborhood: "Centro",
      };

      const { result } = renderHook(() =>
        useAddressMapSync({
          formData: formWithAddress,
          setFormData: asSetFormData(setFormDataMock),
          location: null,
          setLocation: asSetLocation(setLocationMock),
          geocodingService,
        })
      );

      let firstPromise!: Promise<void>;
      await act(async () => {
        firstPromise = result.current.triggerGeocodeNow() as unknown as Promise<void>;
      });
      await act(async () => {
        await result.current.triggerGeocodeNow();
      });
      await act(async () => {
        resolveFirst({ latitude: -27.9, longitude: -48.9 });
        await firstPromise;
      });

      expect(setLocationMock).toHaveBeenCalledTimes(1);
      expect(setLocationMock).toHaveBeenCalledWith({
        latitude: -27.2,
        longitude: -48.2,
      });
    });
  });

  describe("reverse geocode field fallbacks", () => {
    it("keeps neighborhood id when reverse result has no neighborhood", async () => {
      const prevForm: AddressFormData = {
        ...defaultFormData,
        address_neighborhood: "Centro",
        address_neighborhood_id: "n-keep",
      };
      vi.mocked(geocodingService.reverseGeocode).mockResolvedValue({
        latitude: -27.59,
        longitude: -48.54,
        street: "Rua Nova",
      });

      const { result } = renderHook(() =>
        useAddressMapSync({
          formData: prevForm,
          setFormData: asSetFormData(setFormDataMock),
          location: null,
          setLocation: asSetLocation(setLocationMock),
          geocodingService,
        })
      );

      await act(async () => {
        await result.current.handleMapDrag(-27.59, -48.54);
      });

      const updater = setFormDataMock.mock.calls[0][0];
      const next = updater(prevForm);
      expect(next.address_neighborhood_id).toBe("n-keep");
      expect(next.address_zip).toBe("");
    });

    it("allows debounced geocode again after the ignore window", async () => {
      vi.mocked(geocodingService.reverseGeocode).mockResolvedValue(null);
      vi.mocked(geocodingService.geocode).mockResolvedValue({
        latitude: -27.1,
        longitude: -48.1,
      });
      const formWithAddress: AddressFormData = {
        ...defaultFormData,
        address_street: "Rua X",
        address_number: "1",
        address_city: "Florianópolis",
        address_state: "SC",
        address_neighborhood: "Centro",
      };

      const { result, rerender } = renderHook(
        ({ formData }: { formData: AddressFormData }) =>
          useAddressMapSync({
            formData,
            setFormData: asSetFormData(setFormDataMock),
            location: null,
            setLocation: asSetLocation(setLocationMock),
            geocodingService,
          }),
        { initialProps: { formData: formWithAddress } },
      );

      await act(async () => {
        await result.current.handleMapDrag(-27.59, -48.54);
      });
      vi.mocked(geocodingService.geocode).mockClear();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2500);
      });

      rerender({
        formData: { ...formWithAddress, address_number: "2" },
      });

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(geocodingService.geocode).toHaveBeenCalled();
    });
  });

  describe("debounced geocode remaining branches", () => {
    it("logs non-Error failures from the debounced geocode path", async () => {
      const formWithAddress: AddressFormData = {
        ...defaultFormData,
        address_street: "Rua X",
        address_number: "1",
        address_city: "Florianópolis",
        address_state: "SC",
        address_neighborhood: "Centro",
      };
      vi.mocked(geocodingService.geocode).mockRejectedValue("network-down");
      const { logger } = await import("@/lib/logger");

      renderHook(() =>
        useAddressMapSync({
          formData: formWithAddress,
          setFormData: asSetFormData(setFormDataMock),
          location: null,
          setLocation: asSetLocation(setLocationMock),
          geocodingService,
        }),
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(logger.error).toHaveBeenCalledWith(
        "address_geocode_forward_error",
        expect.objectContaining({ error: "network-down" }),
      );
    });

    it("ignores stale debounced geocode results after a newer generation", async () => {
      let resolveFirst!: (value: { latitude: number; longitude: number } | null) => void;
      const first = new Promise<{ latitude: number; longitude: number } | null>((resolve) => {
        resolveFirst = resolve;
      });
      vi.mocked(geocodingService.geocode)
        .mockReturnValueOnce(first)
        .mockResolvedValueOnce({ latitude: -27.2, longitude: -48.2 });

      const formWithAddress: AddressFormData = {
        ...defaultFormData,
        address_street: "Rua X",
        address_number: "1",
        address_city: "Florianópolis",
        address_state: "SC",
        address_neighborhood: "Centro",
      };

      const { rerender } = renderHook(
        ({ formData }: { formData: AddressFormData }) =>
          useAddressMapSync({
            formData,
            setFormData: asSetFormData(setFormDataMock),
            location: null,
            setLocation: asSetLocation(setLocationMock),
            geocodingService,
          }),
        { initialProps: { formData: formWithAddress } },
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1500);
      });

      rerender({
        formData: { ...formWithAddress, address_number: "99" },
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1500);
      });

      await act(async () => {
        resolveFirst({ latitude: -27.9, longitude: -48.9 });
      });

      expect(setLocationMock).toHaveBeenCalledTimes(1);
      expect(setLocationMock).toHaveBeenCalledWith({
        latitude: -27.2,
        longitude: -48.2,
      });
    });

    it("does not set location when triggerGeocodeNow returns null", async () => {
      const formWithAddress: AddressFormData = {
        ...defaultFormData,
        address_street: "Rua X",
        address_number: "1",
        address_city: "Florianópolis",
        address_state: "SC",
        address_neighborhood: "Centro",
      };
      vi.mocked(geocodingService.geocode).mockResolvedValue(null);

      const { result } = renderHook(() =>
        useAddressMapSync({
          formData: formWithAddress,
          setFormData: asSetFormData(setFormDataMock),
          location: null,
          setLocation: asSetLocation(setLocationMock),
          geocodingService,
        }),
      );

      await act(async () => {
        await result.current.triggerGeocodeNow();
      });

      expect(geocodingService.geocode).toHaveBeenCalled();
      expect(setLocationMock).not.toHaveBeenCalled();
    });

    it("logs Error failures from triggerGeocodeNow", async () => {
      const formWithAddress: AddressFormData = {
        ...defaultFormData,
        address_street: "Rua X",
        address_number: "1",
        address_city: "Florianópolis",
        address_state: "SC",
        address_neighborhood: "Centro",
      };
      vi.mocked(geocodingService.geocode).mockRejectedValue(new Error("boom"));
      const { logger } = await import("@/lib/logger");

      const { result } = renderHook(() =>
        useAddressMapSync({
          formData: formWithAddress,
          setFormData: asSetFormData(setFormDataMock),
          location: null,
          setLocation: asSetLocation(setLocationMock),
          geocodingService,
        }),
      );

      await act(async () => {
        await result.current.triggerGeocodeNow();
      });

      expect(logger.error).toHaveBeenCalledWith(
        "address_geocode_forward_error",
        expect.objectContaining({ error: "boom" }),
      );
    });
  });
});
