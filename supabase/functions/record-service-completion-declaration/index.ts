/**
 * Edge Function: record-service-completion-declaration
 *
 * Records auditable client execution declaration (checkbox) with IP + device metadata.
 */

import "xhr";
import { serve } from "std/http/server";
import {
  createRecordDeclarationDeps,
  handleRecordDeclarationRequest,
} from "./handleRequest.ts";

serve((req) => handleRecordDeclarationRequest(req, createRecordDeclarationDeps()));
