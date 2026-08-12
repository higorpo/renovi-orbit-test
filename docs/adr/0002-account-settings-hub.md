# Account settings hub (responsive nav + nested earnings)

Minha conta is a **settings hub**: mobile shows a section list (tab-root) and opens each section as a stack page; desktop keeps a persistent sidebar with content on the right. Canonical paths live under `/dashboard/account/*` (English slugs). Provider **Ganhos** is hosted as `/dashboard/account/earnings` while ownership stays in `provider-earnings`; top-level `/dashboard/earnings`, `/dashboard/conta`, and `/dashboard/addresses` are removed (no redirects).

**Why nest Ganhos instead of a top-level menu item?** One account hub avoids two entry points and frees bottom-nav space; settlement UI remains a separate feature to keep capture history (`payments`) distinct from bank liquidations.

**Why shell-first (phase 1)?** Reusing existing section forms/auto-save delivers the navigation model without rewriting every edit interaction to an Airbnb-style row pattern.
