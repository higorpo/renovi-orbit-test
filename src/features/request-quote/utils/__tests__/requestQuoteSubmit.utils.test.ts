import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildServiceRequestParams,
  uploadPhotosForSubmit,
} from "../requestQuoteSubmit.utils";
import * as serviceRequestsApi from "../../api/serviceRequests.api";

vi.mock("../../api/serviceRequests.api");

describe("requestQuoteSubmit.utils", () => {
  describe("buildServiceRequestParams", () => {
    it("builds params with title prefixed by Pedido de when no suggested title is provided", () => {
      const result = buildServiceRequestParams({
        client_id: "c1",
        service_id: "s1",
        service_title: "Pintura",
        address_id: "a1",
        description: "Desc",
        photoUrls: ["https://example.com/1.jpg"],
        form_data: { size: "large" },
        form_schema: { type: "object" },
        form_version: "v1",
      });
      expect(result.title).toBe("Pedido de Pintura");
      expect(result.client_id).toBe("c1");
      expect(result.service_id).toBe("s1");
      expect(result.address_id).toBe("a1");
      expect(result.description).toBe("Desc");
      expect(result.photos).toEqual(["https://example.com/1.jpg"]);
      expect(result.form_data).toEqual({ size: "large" });
      expect(result.form_schema).toEqual({ type: "object" });
      expect(result.form_version).toBe("v1");
      expect(result.status).toBe("open");
    });

    it("uses AI suggested title when provided", () => {
      const result = buildServiceRequestParams({
        client_id: "c1",
        service_id: "s1",
        service_title: "Pintura",
        service_request_title: "Pintura interna em apartamento",
        address_id: "a1",
        description: "Desc",
        photoUrls: [],
        form_data: {},
        form_schema: null,
        form_version: null,
      });
      expect(result.title).toBe("Pintura interna em apartamento");
    });

    it("falls back to Pedido de title when service_request_title is only whitespace", () => {
      const result = buildServiceRequestParams({
        client_id: "c1",
        service_id: "s1",
        service_title: "Elétrica",
        service_request_title: "   \n\t",
        address_id: null,
        description: "",
        photoUrls: [],
        form_data: {},
        form_schema: null,
        form_version: null,
      });
      expect(result.title).toBe("Pedido de Elétrica");
    });

    it("sets photos to null when photoUrls is empty", () => {
      const result = buildServiceRequestParams({
        client_id: "c1",
        service_id: "s1",
        service_title: "X",
        address_id: null,
        description: "",
        photoUrls: [],
        form_data: {},
        form_schema: null,
        form_version: null,
      });
      expect(result.photos).toBeNull();
    });

    it("sets form_data to null when empty object", () => {
      const result = buildServiceRequestParams({
        client_id: "c1",
        service_id: "s1",
        service_title: "X",
        address_id: null,
        description: "",
        photoUrls: [],
        form_data: {},
        form_schema: null,
        form_version: null,
      });
      expect(result.form_data).toBeNull();
    });

    it("sets form_schema and form_version to null when passed null", () => {
      const result = buildServiceRequestParams({
        client_id: "c1",
        service_id: "s1",
        service_title: "X",
        address_id: null,
        description: "",
        photoUrls: [],
        form_data: {},
        form_schema: null,
        form_version: null,
      });
      expect(result.form_schema).toBeNull();
      expect(result.form_version).toBeNull();
    });
  });

  describe("uploadPhotosForSubmit", () => {
    beforeEach(() => {
      vi.mocked(serviceRequestsApi.uploadPhotosForRequest).mockReset();
    });

    it("returns empty array when photos is empty", async () => {
      const result = await uploadPhotosForSubmit("client-1", []);
      expect(result).toEqual([]);
      expect(serviceRequestsApi.uploadPhotosForRequest).not.toHaveBeenCalled();
    });

    it("returns urls from API on success", async () => {
      vi.mocked(serviceRequestsApi.uploadPhotosForRequest).mockResolvedValue({
        urls: ["https://a.com/1.jpg", "https://a.com/2.jpg"],
        error: null,
      });
      const files = [
        new File(["x"], "1.jpg", { type: "image/jpeg" }),
        new File(["y"], "2.jpg", { type: "image/jpeg" }),
      ];
      const result = await uploadPhotosForSubmit("client-1", files);
      expect(serviceRequestsApi.uploadPhotosForRequest).toHaveBeenCalledWith(
        "client-1",
        files
      );
      expect(result).toEqual(["https://a.com/1.jpg", "https://a.com/2.jpg"]);
    });

    it("returns empty array when API returns no urls", async () => {
      vi.mocked(serviceRequestsApi.uploadPhotosForRequest).mockResolvedValue({
        urls: [],
        error: null,
      });
      const files = [new File(["x"], "1.jpg", { type: "image/jpeg" })];
      const result = await uploadPhotosForSubmit("client-1", files);
      expect(result).toEqual([]);
    });

    it("calls onPartialError when API returns error and callback provided", async () => {
      vi.mocked(serviceRequestsApi.uploadPhotosForRequest).mockResolvedValue({
        urls: ["https://a.com/1.jpg"],
        error: "Upload failed",
      });
      const onPartialError = vi.fn();
      const files = [new File(["x"], "1.jpg", { type: "image/jpeg" })];
      const result = await uploadPhotosForSubmit("client-1", files, onPartialError);
      expect(result).toEqual(["https://a.com/1.jpg"]);
      expect(onPartialError).toHaveBeenCalledOnce();
    });

    it("does not call onPartialError when not provided even if API returns error", async () => {
      vi.mocked(serviceRequestsApi.uploadPhotosForRequest).mockResolvedValue({
        urls: [],
        error: "Upload failed",
      });
      const files = [new File(["x"], "1.jpg", { type: "image/jpeg" })];
      const result = await uploadPhotosForSubmit("client-1", files);
      expect(result).toEqual([]);
    });
  });
});
