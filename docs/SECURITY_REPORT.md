> 🔒 **Localização e sugestão de correção disponíveis no PROguard.** Este relatório FREE mostra o que foi encontrado, não onde nem como corrigir.

# Relatório de Segurança — sergioguimas/eliza

**Scan:** `cmsz0un8s09iokmcyutjv9qzh` · MANUAL · branch `main` · commit `09ac0acf186c`
**Status:** COMPLETED · **Executado em:** 2026-08-18T19:52:40.691Z · **Concluído em:** 2026-08-18T19:55:16.772Z
**Relatório gerado em:** 2026-08-18T20:56:50.208Z por GitGuard

## Instruções para a IA que for corrigir isto

- Repositório alvo: sergioguimas/eliza, branch "main", commit 09ac0acf186c5db18a7716217706261e9725aef4. Aplique as correções diretamente nesse checkout.
- Em "dependencyUpgrades", cada entrada agrupa TODOS os CVEs de um mesmo pacote — faça UM upgrade por pacote (para "recommendedVersion" ou mais recente), não uma correção por CVE.
- Em "secrets", nunca tente adivinhar ou reconstruir o valor original do segredo (ele foi propositalmente redigido) — apenas remova/rotacione conforme "remediation".
- Depois de aplicar as correções, rode os testes existentes do projeto e, se disponível, o linter/build antes de considerar concluído.

## Resumo

- **Total de findings:** 77
- **Por severidade:** CRITICAL: 1 · HIGH: 26 · MEDIUM: 39 · LOW: 11
- **Por scanner:** TRIVY: 65 · SEMGREP: 11 · GITLEAKS: 1

## Dependências para atualizar

### 📦 `jspdf` (9 CVEs) — severidade máxima: CRITICAL

**Ação recomendada:** atualizar de `4.0.0` para `a versão mais recente` (ou superior).

| Severidade | CVE | Descrição | Corrigido em |
|---|---|---|---|
| CRITICAL | CVE-2026-31938 | jspdf: jsPDF: Cross site scripting via unsanitized output options | — |
| HIGH | CVE-2026-24133 | jsPDF: jsPDF: Denial of Service due to excessive memory allocation from crafted BMP images | — |
| HIGH | CVE-2026-24737 | jsPDF: jsPDF: Arbitrary code execution via unsanitized input in Acroform module | — |
| HIGH | CVE-2026-25535 | jsPDF: denial of service via malicious GIF dimensions | — |
| HIGH | CVE-2026-25755 | jsPDF: PDF object injection via unsanitized input in addJS method | — |
| HIGH | CVE-2026-25940 | jsPDF: PDF injection in AcroForm module allows arbitrary JavaScript execution (RadioButton children) | — |
| HIGH | CVE-2026-31898 | jspdf: jsPDF: Arbitrary code execution via unsanitized input in createAnnotation method | — |
| MEDIUM | CVE-2026-24040 | jsPDF: jsPDF: Cross-User Data Leakage via race condition in addJS method | — |
| MEDIUM | CVE-2026-24043 | jsPDF: jsPDF: PDF integrity compromised via arbitrary XML injection in addMetadata function | — |

### 📦 `next` (33 CVEs) — severidade máxima: HIGH

**Ação recomendada:** atualizar de `16.0.8` para `a versão mais recente` (ou superior).

| Severidade | CVE | Descrição | Corrigido em |
|---|---|---|---|
| HIGH | CVE-2026-44575 | next.js: Next.js: Unauthorized access to protected content via middleware bypass | — |
| HIGH | CVE-2026-44578 | Next.js: Next.js: Server-Side Request Forgery via crafted WebSocket upgrade requests | — |
| HIGH | CVE-2026-44579 | next.js: Next.js: Denial of Service via crafted POST requests to server actions | — |
| HIGH | CVE-2026-45109 | next.js: Next.js: Information disclosure via security fix bypass in middleware with Turbopack | — |
| HIGH | CVE-2026-64641 | Next.js: Denial of Service in App Router using Server Actions | — |
| HIGH | CVE-2026-64642 | Next.js: Middleware / Proxy bypass in App Router applications using Turbopack and single locale | — |
| HIGH | CVE-2026-64645 | Next.js: Server-Side Request Forgery in rewrites via attacker-controlled destination hostname | — |
| HIGH | CVE-2026-64649 | Next.js: Server-Side Request Forgery in Server Actions on custom servers | — |
| HIGH | — | Next.js Vulnerable to Denial of Service with Server Components | — |
| HIGH | — | Next.js HTTP request deserialization can lead to DoS when using insecure React Server Components | — |
| HIGH | — | Next Vulnerable to Denial of Service with Server Components | — |
| HIGH | — | Next.js has a Denial of Service with Server Components | — |
| HIGH | CVE-2026-44573 | next.js: Next.js: Information disclosure due to middleware bypass in Pages Router with i18n | — |
| HIGH | CVE-2026-44574 | Next.js: Next.js: Authorization bypass via crafted query parameters | — |
| MEDIUM | CVE-2026-64648 | Next.js: Cache confusion of response bodies for requests with bodies | — |
| MEDIUM | CVE-2025-59471 | next: NextJS Denial of Service in Image Optimizer | — |
| MEDIUM | CVE-2025-59472 | next: NextJS Denial of Service in Partial Pre Rendering | — |
| MEDIUM | CVE-2026-27978 | next.js: Next.js: null origin can bypass Server Actions CSRF checks | — |
| MEDIUM | CVE-2026-27979 | next.js: Next.js: Unbounded postponed resume buffering can lead to DoS | — |
| MEDIUM | CVE-2026-27980 | next.js: Next.js: Unbounded next/image disk cache growth can exhaust storage | — |
| MEDIUM | CVE-2026-29057 | next.js: Next.js: HTTP request smuggling in rewrites | — |
| MEDIUM | CVE-2026-44576 | Next.js: Next.js: Cache poisoning vulnerability in React Server Components | — |
| MEDIUM | CVE-2026-44577 | Next.js: Next.js: Denial of Service via Image Optimization API | — |
| MEDIUM | CVE-2026-44580 | next.js: Next.js: Cross-site scripting allows arbitrary code execution via untrusted script content | — |
| MEDIUM | CVE-2026-44581 | next.js: Next.js: Stored Cross-Site Scripting via malformed nonce values in cached responses | — |
| MEDIUM | CVE-2026-64643 | Next.js: Unauthenticated disclosure of internal Server Function endpoints | — |
| MEDIUM | CVE-2026-64644 | Next.js: Denial of Service in the Image Optimization API using SVGs | — |
| MEDIUM | CVE-2026-64646 | Next.js: Unbounded Server Action payload in Edge runtime | — |
| MEDIUM | CVE-2026-64647 | Next.js: Cache confusion of response bodies for requests with bodies containing invalid UTF-8 byte sequences | — |
| MEDIUM | — | Next Server Actions Source Code Exposure  | — |
| LOW | CVE-2026-27977 | next.js: Next.js: null origin can bypass dev HMR websocket CSRF checks | — |
| LOW | CVE-2026-44582 | Next.js: Next.js: Cache poisoning allows incorrect response delivery | — |
| LOW | CVE-2026-44572 | next.js: Next.js: Denial of Service due to improper handling of x-nextjs-data header with redirects | — |

### 📦 `postcss` (3 CVEs) — severidade máxima: HIGH

**Ação recomendada:** atualizar de `8.4.31` para `a versão mais recente` (ou superior).

| Severidade | CVE | Descrição | Corrigido em |
|---|---|---|---|
| HIGH | CVE-2026-45623 | PostCSS takes a CSS file and provides an API to analyze and modify its ... | — |
| HIGH | — | PostCSS: Path Traversal in Previous Source Map Auto-Loading (sourceMappingURL) leads to Arbitrary .map File Disclosure | — |
| MEDIUM | CVE-2026-41305 | postcss: PostCSS: Cross-Site Scripting (XSS) via improper escaping of style closing tags | — |

### 📦 `sharp` (1 CVE) — severidade máxima: HIGH

**Ação recomendada:** atualizar de `0.34.5` para `a versão mais recente` (ou superior).

| Severidade | CVE | Descrição | Corrigido em |
|---|---|---|---|
| HIGH | — | sharp inherited vulnerabilities in libvips: CVE-2026-33327, CVE-2026-33328, CVE-2026-35590, CVE-2026-35591 | — |

### 📦 `ws` (2 CVEs) — severidade máxima: HIGH

**Ação recomendada:** atualizar de `8.18.3` para `a versão mais recente` (ou superior).

| Severidade | CVE | Descrição | Corrigido em |
|---|---|---|---|
| HIGH | CVE-2026-48779 | ws: ws: Denial of Service via memory exhaustion from small WebSocket fragments | — |
| MEDIUM | CVE-2026-45736 | ws: ws: Uninitialized memory disclosure via `websocket.close()` with `TypedArray` | — |

### 📦 `dompurify` (17 CVEs) — severidade máxima: MEDIUM

**Ação recomendada:** atualizar de `3.3.1` para `a versão mais recente` (ou superior).

| Severidade | CVE | Descrição | Corrigido em |
|---|---|---|---|
| MEDIUM | CVE-2026-0540 | DOMPurify: DOMPurify: Cross-site scripting vulnerability | — |
| MEDIUM | CVE-2026-41238 | DOMPurify: DOMPurify: Cross-Site Scripting bypass via prototype pollution | — |
| MEDIUM | CVE-2026-41239 | DOMPurify: Vue 2: DOMPurify: Cross-site scripting due to incomplete sanitization of template expressions | — |
| MEDIUM | CVE-2026-41240 | DOMPurify: DOMPurify: Cross-Site Scripting (XSS) via inconsistent tag sanitization | — |
| MEDIUM | CVE-2026-49458 | dompurify: DOMPurify: Cross-site scripting due to improper sanitization of DOM nodes | — |
| MEDIUM | CVE-2026-49459 | dompurify: DOMPurify: Cross-site scripting bypass allows arbitrary script execution | — |
| MEDIUM | CVE-2026-49978 | dompurify: DOMPurify: Cross-site scripting vulnerability allows code execution | — |
| MEDIUM | CVE-2026-65898 | DOMPurify before 3.4.11 fails to clone the ALLOWED_ATTR allowlist when ... | — |
| MEDIUM | CVE-2026-65902 | DOMPurify before 3.4.7 (affected versions <= 3.4.5) passes direct refe ... | — |
| MEDIUM | CVE-2026-65903 | dompurify: DOMPurify: Security bypass allows injection of malicious content | — |
| MEDIUM | CVE-2026-65912 | DOMPurify before 3.3.2 contains a URI validation bypass vulnerability  ... | — |
| MEDIUM | CVE-2026-65913 | DOMPurify before 3.3.2 contains a prototype pollution vulnerability in ... | — |
| MEDIUM | CVE-2026-65914 | DOMPurify before 3.3.2 contains a mutation-XSS vulnerability when sani ... | — |
| LOW | CVE-2026-65899 | DOMPurify 3.0.0 before 3.4.9 does not reset the retained Trusted Types ... | — |
| LOW | CVE-2026-65900 | DOMPurify versions >=3.0.0 and before 3.4.8, when configured with SAFE ... | — |
| LOW | CVE-2026-65901 | DOMPurify through 3.4.6 contains a cross-site scripting vulnerability  ... | — |
| LOW | — | DOMPurify: `CUSTOM_ELEMENT_HANDLING` bypasses `afterSanitizeElements` for allowed custom elements. | — |

## Segredos expostos

### 🔑 ? — Secret detected: Discovered a potential authorization token provided in a curl command header, which could compromise the curl accessed resource. (HIGH)

Regra: `curl-auth-header`

**Remediação:** Remova o valor do código-fonte e mova para uma variável de ambiente / secret manager. Se for uma credencial real (não um placeholder de exemplo), revogue-a imediatamente — ela já está exposta no histórico do Git mesmo após removida do arquivo atual.

## Outros findings

| Severidade | Scanner | Categoria | Título | Local |
|---|---|---|---|---|
| HIGH | SEMGREP | SAST | Semgrep Finding: rules.dockerfile.security.missing-user.missing-user | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.ajinabraham.njsscan.crypto.crypto_node.node_insecure_random_generator | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.ajinabraham.njsscan.crypto.crypto_node.node_insecure_random_generator | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.ajinabraham.njsscan.crypto.timing_attack_node.node_timing_attack | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.ajinabraham.njsscan.crypto.crypto_node.node_insecure_random_generator | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.ajinabraham.njsscan.crypto.timing_attack_node.node_timing_attack | — |
| MEDIUM | SEMGREP | SAST | Semgrep Finding: rules.ajinabraham.njsscan.crypto.crypto_node.node_insecure_random_generator | — |
| LOW | SEMGREP | SAST | Semgrep Finding: rules.javascript.lang.security.audit.unsafe-formatstring.unsafe-formatstring | — |
| LOW | SEMGREP | SAST | Semgrep Finding: rules.javascript.lang.security.audit.unsafe-formatstring.unsafe-formatstring | — |
| LOW | SEMGREP | SAST | Semgrep Finding: rules.javascript.lang.security.audit.unsafe-formatstring.unsafe-formatstring | — |
| LOW | SEMGREP | SAST | Semgrep Finding: rules.javascript.lang.security.audit.unsafe-formatstring.unsafe-formatstring | — |
