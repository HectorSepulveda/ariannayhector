const GIFT_SHEET_NAME = "Regalos";
const LEGACY_GIFT_SHEET_NAME = "Gifts";
const RSVP_SHEET_NAME = "Confirmaciones";
const LEGACY_RSVP_SHEET_NAME = "RSVP";
const GIFT_HEADERS = ["id", "regalo", "descripcion", "precio", "cantidad_disponible", "imagen_url", "link_pago", "activo"];
const LEGACY_GIFT_HEADERS = ["id", "name", "stock"];
const GIFT_PAYMENT_SHEET_NAME = "ConfirmacionesRegalos";
const GIFT_PAYMENT_HEADERS = [
  "fecha_registro",
  "enviado_en_iso",
  "gift_id",
  "regalo",
  "precio",
  "nombre_invitado",
  "mensaje",
  "stock_restante",
];
const RSVP_HEADERS = [
  "fecha_registro",
  "enviado_en_iso",
  "asistencia",
  "nombre",
  "correo",
  "con_acompanante",
  "nombre_acompanante",
  "restricciones_alimentarias",
  "otras_restricciones",
  "restricciones_alimentarias_acompanante",
  "otras_restricciones_acompanante",
  "cancion_sugerida",
  "mensaje",
];
const ACCESS_SHEET_NAME = "Invitados";
const LEGACY_ACCESS_SHEET_NAME = "Accesos";
const ACCESS_HEADERS = [
  "nombre",
  "codigo_acceso",
  "solo",
  "primer_acceso",
  "ultimo_acceso",
  "total_accesos",
];
const SETTINGS_SHEET_NAME = "Parametros";
const SETTINGS_HEADERS = ["parametro", "valor"];
const SETTINGS_DEFAULTS = {
  habilitar_rsvp: true,
  habilitar_codigo_acceso: true,
  habilitar_subida_fotos: false,
};
const PHOTO_UPLOAD_SHEET_NAME = "FotosInvitados";
const PHOTO_UPLOAD_HEADERS = [
  "fecha_registro",
  "enviado_en_iso",
  "nombre",
  "comentario",
  "cantidad_fotos",
  "archivo_nombre",
  "archivo_url",
  "archivo_id",
  "tamano_bytes",
  "tipo_mime",
];
const LEGACY_RSVP_HEADERS = [
  "timestamp",
  "submitted_at_iso",
  "attendance",
  "name",
  "email",
  "with_partner",
  "partner_name",
  "dietary_self",
  "dietary_other_self",
  "dietary_partner",
  "dietary_other_partner",
  "song",
  "message",
];

function doGet(e) {
  const action = e && e.parameter && e.parameter.action
    ? String(e.parameter.action).trim().toLowerCase()
    : "";

  if (action === "settings") {
    return jsonResponse_({ ok: true, settings: getSiteSettings_() });
  }

  if (action === "drive_check") {
    return jsonResponse_(runDriveCheck_());
  }

  const data = getGiftData_();
  return jsonResponse_(data);
}

function doPost(e) {
  try {
    const payload = parsePayload_(e);

    if (payload.action === "reserve" && payload.giftId) {
      const result = reserveGift_(String(payload.giftId));
      return jsonResponse_(result);
    }

    if (payload.action === "rsvp") {
      const result = saveRsvp_(payload);
      return jsonResponse_(result);
    }

    if (payload.action === "access") {
      const result = registerAccess_(payload);
      return jsonResponse_(result);
    }

    if (payload.action === "upload_photos") {
      const result = saveGuestPhotos_(payload);
      return jsonResponse_(result);
    }

    if (payload.action === "gift_payment_confirm") {
      const result = confirmGiftPayment_(payload);
      return jsonResponse_(result);
    }

    return jsonResponse_({ ok: false, error: "Accion invalida" });
  } catch (error) {
    return jsonResponse_({ ok: false, error: "JSON invalido" });
  }
}

function registerAccess_(payload) {
  const siteSettings = getSiteSettings_();
  if (!siteSettings.habilitar_codigo_acceso) {
    return { ok: true, autorizado: true, invitado: "" };
  }

  const code = normalizeAccessCode_(pick_(payload, ["codigo", "codigoAcceso", "accessCode", "code"]));
  if (!code) {
    return { ok: false, error: "Codigo obligatorio" };
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const sheet = getOrCreateSheet_(
      ACCESS_SHEET_NAME,
      ACCESS_HEADERS,
      [LEGACY_ACCESS_SHEET_NAME],
      null
    );

    const accessColumns = getAccessColumns_(sheet);
    if (!accessColumns.code) {
      return { ok: false, error: "Falta la columna de codigo de acceso" };
    }

    const values = sheet.getDataRange().getValues();
    if (values.length < 2) {
      return { ok: false, error: "No hay invitados cargados" };
    }

    for (let i = 1; i < values.length; i += 1) {
      const row = values[i];
      const rowCode = normalizeAccessCode_(row[accessColumns.code - 1]);
      if (!rowCode || rowCode !== code) continue;

      const now = new Date();
      const firstAccess = row[accessColumns.first - 1];
      const currentTotal = Number(row[accessColumns.total - 1]);
      const safeTotal = Number.isFinite(currentTotal) ? currentTotal : 0;

      if (!firstAccess) {
        sheet.getRange(i + 1, accessColumns.first).setValue(now);
      }
      sheet.getRange(i + 1, accessColumns.last).setValue(now);
      sheet.getRange(i + 1, accessColumns.total).setValue(safeTotal + 1);

      const guestName = String(row[accessColumns.name - 1] || "").trim();
      const solo = toBooleanSetting_(row[accessColumns.solo - 1], false);
      return {
        ok: true,
        autorizado: true,
        invitado: guestName,
        solo,
        primerIngresoRegistrado: !firstAccess,
      };
    }

    return { ok: false, error: "Codigo invalido" };
  } finally {
    lock.releaseLock();
  }
}

function parsePayload_(e) {
  const rawBody = e && e.postData && typeof e.postData.contents === "string"
    ? e.postData.contents
    : "";
  if (rawBody) {
    try {
      return JSON.parse(rawBody);
    } catch (err) {
      // Continue with form payload fallback.
    }
  }

  const formPayload = e && e.parameter && e.parameter.payload
    ? String(e.parameter.payload)
    : "";
  if (formPayload) {
    return JSON.parse(formPayload);
  }

  return {};
}

function saveRsvp_(payload) {
  const asistencia = normalizeAttendance_(pick_(payload, ["asistencia", "attendance"]));
  const nombre = String(pick_(payload, ["nombre", "name"]) || "").trim();

  if (asistencia !== "si" && asistencia !== "no") {
    return { ok: false, error: "Asistencia invalida" };
  }
  if (!nombre) {
    return { ok: false, error: "Nombre obligatorio" };
  }

  const conAcompanante = toBoolean_(pick_(payload, ["conAcompanante", "withPartner"]));
  const nombreAcompanante = conAcompanante
    ? String(pick_(payload, ["nombreAcompanante", "partnerName"]) || "").trim()
    : "";

  if (asistencia === "si" && conAcompanante && !nombreAcompanante) {
    return { ok: false, error: "Nombre de acompanante obligatorio" };
  }

  const row = [
    new Date(),
    String(pick_(payload, ["enviadoEnIso", "submittedAt"]) || ""),
    asistencia,
    nombre,
    String(pick_(payload, ["correo", "email"]) || "").trim(),
    conAcompanante ? "si" : "no",
    nombreAcompanante,
    normalizeList_(pick_(payload, ["restriccionesAlimentarias", "dietarySelf"])),
    String(pick_(payload, ["otrasRestricciones", "dietaryOtherSelf"]) || "").trim(),
    normalizeList_(pick_(payload, ["restriccionesAlimentariasAcompanante", "dietaryPartner"])),
    String(pick_(payload, ["otrasRestriccionesAcompanante", "dietaryOtherPartner"]) || "").trim(),
    String(pick_(payload, ["cancionSugerida", "song"]) || "").trim(),
    String(pick_(payload, ["mensaje", "message"]) || "").trim(),
  ];

  const sheet = getOrCreateSheet_(
    RSVP_SHEET_NAME,
    RSVP_HEADERS,
    [LEGACY_RSVP_SHEET_NAME],
    LEGACY_RSVP_HEADERS
  );
  sheet.appendRow(row);
  return { ok: true };
}

function saveGuestPhotos_(payload) {
  const siteSettings = getSiteSettings_();
  if (!siteSettings.habilitar_subida_fotos) {
    return { ok: false, error: "La carga de fotos esta deshabilitada." };
  }

  const guestName = String(pick_(payload, ["nombre", "name"]) || "").trim();
  if (!guestName) {
    return { ok: false, error: "Nombre obligatorio" };
  }

  const photos = Array.isArray(payload.fotos) ? payload.fotos : [];
  if (photos.length === 0) {
    return { ok: false, error: "Debes adjuntar al menos una foto." };
  }

  const folderId = getPhotoFolderId_();
  if (!folderId) {
    return { ok: false, error: "Falta configurar fotos_drive_folder_id en Parametros." };
  }

  let folder;
  try {
    folder = DriveApp.getFolderById(folderId);
  } catch (error) {
    return { ok: false, error: "No se pudo acceder a la carpeta de Google Drive." };
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const now = new Date();
    const nowIso = String(pick_(payload, ["enviadoEnIso", "submittedAt"]) || now.toISOString());
    const comment = String(pick_(payload, ["comentario", "comment"]) || "").trim();
    const totalPhotos = photos.length;
    const metadataRows = [];
    const uploadedFiles = [];
    const safeGuestName = sanitizeFileName_(guestName);

    for (let i = 0; i < photos.length; i += 1) {
      const file = photos[i] || {};
      const base64Data = String(pick_(file, ["base64", "data"]) || "").trim();
      if (!base64Data) {
        return { ok: false, error: "Una de las fotos no contiene datos validos." };
      }

      const mimeType = String(pick_(file, ["tipoMime", "mimeType"]) || "application/octet-stream").trim();
      const originalName = String(pick_(file, ["nombreArchivo", "fileName"]) || `foto-${i + 1}`).trim();
      const extension = extensionFromMimeType_(mimeType) || extensionFromFileName_(originalName) || "jpg";
      const uploadName = `${safeGuestName}-${Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyyMMdd-HHmmss")}-${i + 1}.${extension}`;

      let bytes;
      try {
        bytes = Utilities.base64Decode(base64Data);
      } catch (error) {
        return { ok: false, error: "No se pudo procesar una de las fotos." };
      }

      const blob = Utilities.newBlob(bytes, mimeType, uploadName);
      const createdFile = folder.createFile(blob);
      uploadedFiles.push(createdFile);

      metadataRows.push([
        now,
        nowIso,
        guestName,
        comment,
        totalPhotos,
        uploadName,
        createdFile.getUrl(),
        createdFile.getId(),
        Number(pick_(file, ["tamanoBytes", "sizeBytes"]) || bytes.length || 0),
        mimeType,
      ]);
    }

    const sheet = getOrCreateSheet_(
      PHOTO_UPLOAD_SHEET_NAME,
      PHOTO_UPLOAD_HEADERS,
      null,
      null
    );
    if (metadataRows.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, metadataRows.length, PHOTO_UPLOAD_HEADERS.length)
        .setValues(metadataRows);
    }

    return {
      ok: true,
      cantidad_fotos: uploadedFiles.length,
      archivos: uploadedFiles.map(function (file) {
        return { id: file.getId(), url: file.getUrl(), nombre: file.getName() };
      }),
    };
  } finally {
    lock.releaseLock();
  }
}

function getGiftData_() {
  const sheet = getGiftSheet_();
  const values = sheet.getDataRange().getValues();
  const columns = getGiftColumns_(sheet);
  const gifts = [];

  for (let i = 1; i < values.length; i += 1) {
    const row = values[i];
    const id = String(row[columns.id - 1] || "").trim();
    if (!id) continue;

    const name = String(row[columns.name - 1] || "").trim();
    const description = String(row[columns.description - 1] || "").trim();
    const price = toNumber_(row[columns.price - 1]);
    const stock = toNumber_(row[columns.stock - 1]);
    const imageUrl = String(row[columns.image - 1] || "").trim();
    const paymentUrl = String(row[columns.payment - 1] || "").trim();
    const active = toBooleanSetting_(row[columns.active - 1], true);
    if (!active) continue;

    gifts.push({
      id,
      name,
      regalo: name,
      description,
      descripcion: description,
      price,
      precio: price,
      stock,
      cantidad_disponible: stock,
      imageUrl,
      imagen_url: imageUrl,
      paymentUrl,
      link_pago: paymentUrl,
    });
  }

  return { ok: true, gifts };
}

function reserveGift_(giftId) {
  const sheet = getGiftSheet_();
  const columns = getGiftColumns_(sheet);
  const values = sheet.getDataRange().getValues();

  for (let i = 1; i < values.length; i += 1) {
    const row = values[i];
    const id = String(row[columns.id - 1] || "").trim();
    if (id !== giftId) continue;

    const current = toNumber_(row[columns.stock - 1]);
    if (current <= 0) {
      return { ok: false, remaining: 0, error: "Agotado" };
    }

    const next = current - 1;
    sheet.getRange(i + 1, columns.stock).setValue(next);
    return { ok: true, remaining: next };
  }

  return { ok: false, remaining: 0, error: "No encontrado" };
}

function confirmGiftPayment_(payload) {
  const giftId = String(pick_(payload, ["giftId", "id"]) || "").trim();
  const guestName = String(pick_(payload, ["nombre", "name"]) || "").trim();
  const message = String(pick_(payload, ["mensaje", "message"]) || "").trim();
  const submittedAt = String(pick_(payload, ["enviadoEnIso", "submittedAt"]) || new Date().toISOString());

  if (!giftId) return { ok: false, error: "Regalo obligatorio" };
  if (!guestName) return { ok: false, error: "Nombre obligatorio" };

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const sheet = getGiftSheet_();
    const columns = getGiftColumns_(sheet);
    const values = sheet.getDataRange().getValues();

    for (let i = 1; i < values.length; i += 1) {
      const row = values[i];
      const id = String(row[columns.id - 1] || "").trim();
      if (id !== giftId) continue;

      const giftName = String(row[columns.name - 1] || "").trim();
      const giftPrice = toNumber_(row[columns.price - 1]);
      const paymentUrl = String(row[columns.payment - 1] || "").trim();
      const current = toNumber_(row[columns.stock - 1]);
      if (!paymentUrl) {
        return { ok: false, error: "Este regalo no tiene link de pago configurado." };
      }
      if (current <= 0) {
        return { ok: false, error: "Este regalo ya no tiene disponibilidad." };
      }

      const remaining = current - 1;
      sheet.getRange(i + 1, columns.stock).setValue(remaining);

      const paymentSheet = getOrCreateSheet_(
        GIFT_PAYMENT_SHEET_NAME,
        GIFT_PAYMENT_HEADERS,
        null,
        null
      );

      paymentSheet.appendRow([
        new Date(),
        submittedAt,
        giftId,
        giftName,
        giftPrice,
        guestName,
        message,
        remaining,
      ]);

      return {
        ok: true,
        giftId,
        giftName,
        remaining,
        paymentUrl,
      };
    }

    return { ok: false, error: "Regalo no encontrado." };
  } finally {
    lock.releaseLock();
  }
}

function getGiftSheet_() {
  return getOrCreateSheet_(
    GIFT_SHEET_NAME,
    GIFT_HEADERS,
    [LEGACY_GIFT_SHEET_NAME],
    LEGACY_GIFT_HEADERS
  );
}

function getGiftColumns_(sheet) {
  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  const normalized = headers.map((value) => normalizeHeader_(value));

  const ensureColumn = function (aliases, headerTitle) {
    const existing = findHeaderIndex_(normalized, aliases);
    if (existing > 0) return existing;

    const next = normalized.length + 1;
    sheet.getRange(1, next).setValue(headerTitle);
    normalized.push(normalizeHeader_(headerTitle));
    return next;
  };

  return {
    id: ensureColumn(["id"], "id"),
    name: ensureColumn(["regalo", "name", "gift", "nombre_regalo", "nombre"], "regalo"),
    description: ensureColumn(["descripcion", "description", "detalle", "descripcion_regalo"], "descripcion"),
    price: ensureColumn(["precio", "price", "monto", "valor", "costo", "importe"], "precio"),
    stock: ensureColumn(["cantidad_disponible", "stock", "cantidad", "disponibles", "stock_disponible", "cantidad_restante", "cupos"], "cantidad_disponible"),
    image: ensureColumn(["imagen_url", "image_url", "imagen", "foto", "url_imagen", "foto_url", "imagenurl"], "imagen_url"),
    payment: ensureColumn(["link_pago", "payment_url", "url_pago", "pasarela_url", "link_de_pago", "checkout_url", "payment"], "link_pago"),
    active: ensureColumn(["activo", "active", "habilitado", "mostrar"], "activo"),
  };
}

function getSettingsSheet_() {
  return getOrCreateSheet_(
    SETTINGS_SHEET_NAME,
    SETTINGS_HEADERS,
    null,
    null
  );
}

function getSiteSettings_() {
  const sheet = getSettingsSheet_();
  const values = sheet.getDataRange().getValues();
  const settings = {
    habilitar_rsvp: SETTINGS_DEFAULTS.habilitar_rsvp,
    habilitar_codigo_acceso: SETTINGS_DEFAULTS.habilitar_codigo_acceso,
    habilitar_subida_fotos: SETTINGS_DEFAULTS.habilitar_subida_fotos,
  };

  for (let i = 1; i < values.length; i += 1) {
    const parameterName = normalizeHeader_(values[i][0]);
    const value = values[i][1];
    if (!parameterName) continue;

    if (parameterName === "habilitar_rsvp") {
      settings.habilitar_rsvp = toBooleanSetting_(value, SETTINGS_DEFAULTS.habilitar_rsvp);
      continue;
    }

    if (parameterName === "habilitar_codigo_acceso") {
      settings.habilitar_codigo_acceso = toBooleanSetting_(value, SETTINGS_DEFAULTS.habilitar_codigo_acceso);
      continue;
    }

    if (parameterName === "habilitar_subida_fotos") {
      settings.habilitar_subida_fotos = toBooleanSetting_(value, SETTINGS_DEFAULTS.habilitar_subida_fotos);
      continue;
    }
  }

  return settings;
}

function getOrCreateSheet_(name, headers, legacyNames, legacyHeaders) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(name);

  if (!sheet && Array.isArray(legacyNames)) {
    for (let i = 0; i < legacyNames.length; i += 1) {
      const legacyName = legacyNames[i];
      sheet = spreadsheet.getSheetByName(legacyName);
      if (sheet) break;
    }
  }

  if (!sheet) {
    sheet = spreadsheet.insertSheet(name);
  }

  ensureHeaders_(sheet, headers, legacyHeaders);
  return sheet;
}

function ensureHeaders_(sheet, headers, legacyHeaders) {
  if (sheet.getLastRow() < 1) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    return;
  }

  const current = sheet.getRange(1, 1, 1, headers.length).getValues()[0]
    .map((value) => String(value || "").trim().toLowerCase());

  const normalizedHeaders = headers.map((value) => String(value || "").trim().toLowerCase());
  if (arraysEqual_(current, normalizedHeaders)) {
    return;
  }

  if (Array.isArray(legacyHeaders)) {
    const normalizedLegacyHeaders = legacyHeaders.map((value) => String(value || "").trim().toLowerCase());
    if (arraysEqual_(current, normalizedLegacyHeaders)) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
  }
}

function normalizeList_(value) {
  if (!Array.isArray(value)) return "";
  return value
    .map((item) => String(item || "").trim())
    .filter((item) => item.length > 0)
    .join(", ");
}

function normalizeAttendance_(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "si" || normalized === "sÃ¯Â¿Â½" || normalized === "yes") {
    return "si";
  }
  if (normalized === "no") {
    return "no";
  }
  return "";
}

function toBoolean_(value) {
  if (typeof value === "boolean") return value;
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "si" || normalized === "yes";
}

function toNumber_(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const raw = String(value || "").trim();
  if (!raw) return 0;

  let normalized = raw
    .replace(/\s/g, "")
    .replace(/[^\d,.-]/g, "");
  if (!normalized) return 0;

  const commaIndex = normalized.lastIndexOf(",");
  const dotIndex = normalized.lastIndexOf(".");
  if (commaIndex >= 0 && dotIndex >= 0) {
    if (commaIndex > dotIndex) {
      normalized = normalized.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = normalized.replace(/,/g, "");
    }
  } else if (commaIndex >= 0) {
    const commaCount = (normalized.match(/,/g) || []).length;
    if (commaCount > 1) {
      normalized = normalized.replace(/,/g, "");
    } else {
      const parts = normalized.split(",");
      if (parts.length === 2 && parts[1].length === 3) {
        normalized = `${parts[0]}${parts[1]}`;
      } else {
        normalized = `${parts[0]}.${parts[1] || ""}`;
      }
    }
  } else if (dotIndex >= 0) {
    const dotCount = (normalized.match(/\./g) || []).length;
    if (dotCount > 1) {
      normalized = normalized.replace(/\./g, "");
    } else {
      const parts = normalized.split(".");
      if (parts.length === 2 && parts[1].length === 3) {
        normalized = `${parts[0]}${parts[1]}`;
      }
    }
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function pick_(source, keys) {
  if (!source || !Array.isArray(keys)) return "";
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    if (Object.prototype.hasOwnProperty.call(source, key) && source[key] !== undefined && source[key] !== null) {
      return source[key];
    }
  }
  return "";
}

function getPhotoFolderId_() {
  const sheet = getSettingsSheet_();
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i += 1) {
    const parameterName = normalizeHeader_(values[i][0]);
    const value = String(values[i][1] || "").trim();
    if (!parameterName || !value) continue;
    if (parameterName === "fotos_drive_folder_id" || parameterName === "carpeta_fotos_drive_id") {
      return normalizeDriveFolderId_(value);
    }
  }
  return "";
}

function runDriveCheck_() {
  const sheet = getSettingsSheet_();
  const values = sheet.getDataRange().getValues();
  let rawFolderValue = "";

  for (let i = 1; i < values.length; i += 1) {
    const parameterName = normalizeHeader_(values[i][0]);
    const value = String(values[i][1] || "").trim();
    if (!parameterName || !value) continue;
    if (parameterName === "fotos_drive_folder_id" || parameterName === "carpeta_fotos_drive_id") {
      rawFolderValue = value;
      break;
    }
  }

  const folderId = normalizeDriveFolderId_(rawFolderValue);
  const result = {
    ok: false,
    parametro_encontrado: rawFolderValue ? true : false,
    carpeta_valor_original: rawFolderValue,
    carpeta_id_normalizada: folderId,
    effective_user: "",
    folder_name: "",
    folder_url: "",
    can_create_file: false,
    error: "",
  };

  try {
    result.effective_user = String(Session.getEffectiveUser().getEmail() || "");
  } catch (error) {
    result.effective_user = "";
  }

  if (!folderId) {
    result.error = "Falta configurar fotos_drive_folder_id.";
    return result;
  }

  try {
    const folder = DriveApp.getFolderById(folderId);
    result.folder_name = folder.getName();
    result.folder_url = folder.getUrl();

    const probeName = `drive-check-${new Date().getTime()}.txt`;
    const file = folder.createFile(probeName, "ok");
    result.can_create_file = true;
    file.setTrashed(true);

    result.ok = true;
    return result;
  } catch (error) {
    result.error = String(error && error.message ? error.message : error);
    return result;
  }
}
function normalizeDriveFolderId_(rawValue) {
  const value = String(rawValue || "").trim();
  if (!value) return "";

  // Accept raw folder id directly.
  if (/^[a-zA-Z0-9_-]{20,}$/.test(value)) {
    return value;
  }

  // Accept full Drive folder URL and extract id.
  const folderMatch = value.match(/\/folders\/([a-zA-Z0-9_-]{20,})/);
  if (folderMatch && folderMatch[1]) {
    return folderMatch[1];
  }

  return value;
}

function extensionFromMimeType_(mimeType) {
  const normalized = String(mimeType || "").trim().toLowerCase();
  if (normalized === "image/jpeg" || normalized === "image/jpg") return "jpg";
  if (normalized === "image/png") return "png";
  if (normalized === "image/webp") return "webp";
  if (normalized === "image/heic") return "heic";
  return "";
}

function extensionFromFileName_(fileName) {
  const cleanName = String(fileName || "").trim();
  const match = cleanName.match(/\.([a-zA-Z0-9]{2,8})$/);
  if (!match) return "";
  return String(match[1] || "").toLowerCase();
}

function sanitizeFileName_(value) {
  const cleanValue = String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleanValue || "invitado";
}

function arraysEqual_(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  if (left.length !== right.length) return false;

  for (let i = 0; i < left.length; i += 1) {
    if (left[i] !== right[i]) return false;
  }

  return true;
}

function getAccessColumns_(sheet) {
  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  const normalized = headers.map((value) => normalizeHeader_(value));

  const ensureColumn = function (aliases, headerTitle) {
    const existing = findHeaderIndex_(normalized, aliases);
    if (existing > 0) return existing;

    const next = normalized.length + 1;
    sheet.getRange(1, next).setValue(headerTitle);
    normalized.push(normalizeHeader_(headerTitle));
    return next;
  };

  return {
    name: ensureColumn(["nombre", "name", "invitado"], "nombre"),
    code: ensureColumn(["codigo_acceso", "codigo", "codigo de acceso", "access_code", "code"], "codigo_acceso"),
    solo: ensureColumn(["solo", "ira_solo", "va_solo", "sin_acompanante", "solo_invitado"], "solo"),
    first: ensureColumn(["primer_acceso", "primer acceso", "first_access", "first access"], "primer_acceso"),
    last: ensureColumn(["ultimo_acceso", "ultimo acceso", "last_access", "last access"], "ultimo_acceso"),
    total: ensureColumn(["total_accesos", "total accesos", "ingresos", "access_count"], "total_accesos"),
  };
}

function findHeaderIndex_(normalizedHeaders, aliases) {
  if (!Array.isArray(normalizedHeaders) || !Array.isArray(aliases)) return 0;
  for (let i = 0; i < aliases.length; i += 1) {
    const alias = normalizeHeader_(aliases[i]);
    const index = normalizedHeaders.indexOf(alias);
    if (index >= 0) return index + 1;
  }
  return 0;
}

function normalizeHeader_(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_");
}

function normalizeAccessCode_(value) {
  return String(value || "").trim().toUpperCase();
}

function toBooleanSetting_(value, defaultValue) {
  if (value === "" || value === null || value === undefined) return defaultValue;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;

  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "si" || normalized === "sÃ¯Â¿Â½" || normalized === "yes" || normalized === "on") {
    return true;
  }
  if (normalized === "false" || normalized === "0" || normalized === "no" || normalized === "off") {
    return false;
  }
  return defaultValue;
}

function jsonResponse_(payload) {
  const output = ContentService.createTextOutput(JSON.stringify(payload));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}





