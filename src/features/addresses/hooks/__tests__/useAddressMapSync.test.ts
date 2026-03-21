import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Dispatch, SetStateAction } from "react";
import { renderHook, act } from "@testing-library/react";
import { useAddressMapSync } from "../useAddressMapSync";
import type { GeocodingService, ReverseGeocodingResult } from "@/lib/geocoding";
import type { AddressFormData } from "../../types/addressForm.validation";
import type { AddressLocation } from "../../types/addresses.types";

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
  });
});
