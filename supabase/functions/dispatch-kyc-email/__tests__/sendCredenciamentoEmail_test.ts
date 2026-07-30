import {
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  DEFAULT_NETCRED_CREDENCIAMENTO_EMAIL,
  NETCRED_CREDENCIAMENTO_EMAIL_ENV,
  resolveCredenciamentoRecipientEmail,
} from "../sendCredenciamentoEmail.ts";

Deno.test("DEFAULT_NETCRED_CREDENCIAMENTO_EMAIL is Renovi inbox", () => {
  assertEquals(
    DEFAULT_NETCRED_CREDENCIAMENTO_EMAIL,
    "credenciamento@renovi.com.br",
  );
});

Deno.test("resolveCredenciamentoRecipientEmail falls back to Renovi default", () => {
  const previous = Deno.env.get(NETCRED_CREDENCIAMENTO_EMAIL_ENV);
  Deno.env.delete(NETCRED_CREDENCIAMENTO_EMAIL_ENV);
  try {
    assertEquals(
      resolveCredenciamentoRecipientEmail(),
      "credenciamento@renovi.com.br",
    );
  } finally {
    if (previous === undefined) {
      Deno.env.delete(NETCRED_CREDENCIAMENTO_EMAIL_ENV);
    } else {
      Deno.env.set(NETCRED_CREDENCIAMENTO_EMAIL_ENV, previous);
    }
  }
});
