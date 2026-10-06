/* eslint-disable @typescript-eslint/no-explicit-any -- payload externo da Evolution, sem schema; mesmos tipos soltos que o webhook sempre teve. */
/**
 * Extração de dados do payload `messages.upsert` da Evolution. Compartilhada pelo
 * webhook do WhatsApp e pelo encaminhamento ao atendente (06), para os dois lerem
 * número, instância e texto do mesmo jeito.
 */

export function extractMessageText(messageContent: any) {
  if (messageContent?.conversation) {
    return messageContent.conversation
  }

  if (messageContent?.extendedTextMessage?.text) {
    return messageContent.extendedTextMessage.text
  }

  if (messageContent?.buttonsResponseMessage?.selectedButtonId) {
    return messageContent.buttonsResponseMessage.selectedButtonId
  }

  if (messageContent?.buttonsResponseMessage?.selectedDisplayText) {
    return messageContent.buttonsResponseMessage.selectedDisplayText
  }

  if (messageContent?.listResponseMessage?.singleSelectReply?.selectedRowId) {
    return messageContent.listResponseMessage.singleSelectReply.selectedRowId
  }

  if (messageContent?.listResponseMessage?.title) {
    return messageContent.listResponseMessage.title
  }

  return ""
}

/**
 * Número de quem mandou a mensagem, só para conversa 1:1.
 *
 * `body.sender` NÃO entra: no payload da Evolution ele é o número da própria
 * instância (o tenant), não o do cliente. Grupo (`@g.us`) e JID `@lid` sem
 * `remoteJidAlt` não identificam um telefone e são descartados.
 */
export function extractIncomingNumber(body: any) {
  const key = body.data?.key
  const candidates = [key?.remoteJidAlt, key?.remoteJid]

  for (const jid of candidates) {
    if (typeof jid === "string" && jid.endsWith("@s.whatsapp.net")) {
      return jid.replace(/@.*/, "").replace(/\D/g, "")
    }
  }

  return ""
}

export function extractInstanceName(body: any) {
  return (
    body.instance ||
    body.instanceName ||
    body.data?.instance ||
    body.data?.instanceName ||
    body.server_url ||
    null
  )
}
