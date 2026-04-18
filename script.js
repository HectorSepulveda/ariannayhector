const settings = {
  couple1: "Arianna",
  couple2: "Hector",
  weddingDate: "2026-05-02",
  ceremonyTime: "17:00",
  celebrationTime: "19:00",
  venue: "Espacio Nehuen",
  location: "Talagante, Region Metropolitana",
};

const ACCESS_SESSION_KEY = "invitation_access_granted";
const DEFAULT_SITE_SETTINGS = {
  habilitar_rsvp: true,
  habilitar_codigo_acceso: true,
  habilitar_subida_fotos: false,
};

const rsvpApiUrl = typeof window !== "undefined" ? window.RSVP_API_URL || "" : "";

const fetchSiteSettings = async () => {
  if (!rsvpApiUrl) return DEFAULT_SITE_SETTINGS;

  try {
    const apiUrl = rsvpApiUrl.trim();
    const separator = apiUrl.includes("?") ? "&" : "?";
    const response = await fetch(`${apiUrl}${separator}action=settings`, { cache: "no-store" });
    if (!response.ok) return DEFAULT_SITE_SETTINGS;
    const payload = await response.json();
    const rawSettings = payload && payload.settings ? payload.settings : {};
    return {
      habilitar_rsvp: rawSettings.habilitar_rsvp !== false,
      habilitar_codigo_acceso: rawSettings.habilitar_codigo_acceso !== false,
      habilitar_subida_fotos: rawSettings.habilitar_subida_fotos === true,
    };
  } catch (error) {
    return DEFAULT_SITE_SETTINGS;
  }
};

const siteSettingsPromise = fetchSiteSettings();
const carousel = document.getElementById("hero-carousel");
const loadCarouselSlide = (img) => {
  if (!img) return;
  if (img.getAttribute("src")) return;
  const src = img.getAttribute("data-src");
  if (!src) return;
  img.setAttribute("src", src);
};

const buildCarouselSlides = (images) => {
  if (!carousel) return;
  carousel.innerHTML = "";
  images.forEach((filename, index) => {
    const img = document.createElement("img");
    const src = `assets/galeria-pre/${filename}`;
    img.alt = `Foto preboda ${index + 1}`;
    img.loading = index === 0 ? "eager" : "lazy";
    img.decoding = "async";
    img.fetchPriority = index === 0 ? "high" : "low";
    img.className = "w-full h-full object-cover flex-shrink-0";
    img.style.flex = "0 0 100%";
    img.style.width = "100%";
    img.style.minWidth = "100%";
    img.style.display = "block";
    img.setAttribute("data-src", src);
    if (index === 0) {
      img.setAttribute("src", src);
    }
    carousel.appendChild(img);
  });
};

const startCarousel = () => {
  if (!carousel) return;
  const total = carousel.children.length;
  if (total <= 1) return;

  const slides = Array.from(carousel.children);
  let currentIndex = 0;
  const getSlideWidth = () => {
    const parent = carousel.parentElement;
    if (!parent) return 0;
    return parent.getBoundingClientRect().width;
  };

  const ensureNearbySlidesLoaded = (index) => {
    const targets = [index, index + 1, index + 2, index - 1];
    targets.forEach((targetIndex) => {
      const wrapped = ((targetIndex % total) + total) % total;
      loadCarouselSlide(slides[wrapped]);
    });
  };

  const updatePosition = () => {
    const slideWidth = getSlideWidth();
    if (slideWidth === 0) return;
    const offset = currentIndex * slideWidth;
    carousel.style.transform = `translate3d(-${offset}px, 0, 0)`;
    ensureNearbySlidesLoaded(currentIndex);
  };

  ensureNearbySlidesLoaded(0);
  updatePosition();
  window.addEventListener("resize", updatePosition);

  setInterval(() => {
    currentIndex = (currentIndex + 1) % total;
    updatePosition();
  }, 4000);
};

const loadCarouselImages = async () => {
  if (!carousel) return;

  try {
    let images = [];
    const response = await fetch("assets/galeria-pre/manifest.json", { cache: "no-store" });
    if (response.ok) {
      images = await response.json();
    } else if (Array.isArray(window.CAROUSEL_IMAGES)) {
      images = window.CAROUSEL_IMAGES;
    } else {
      throw new Error("Manifest not found");
    }
    if (!Array.isArray(images) || images.length === 0) {
      startCarousel();
      return;
    }

    buildCarouselSlides(images);

    startCarousel();
  } catch (error) {
    if (Array.isArray(window.CAROUSEL_IMAGES) && window.CAROUSEL_IMAGES.length > 0) {
      buildCarouselSlides(window.CAROUSEL_IMAGES);
      startCarousel();
      return;
    }
    startCarousel();
  }
};

loadCarouselImages();
const heroCta = document.getElementById("hero-cta");
if (heroCta) {
  heroCta.addEventListener("click", () => {
    const target = document.getElementById("rsvp");
    if (target) target.scrollIntoView({ behavior: "smooth" });
  });
}

const overlay = document.getElementById("intro-overlay");
const introVideo = document.getElementById("intro-video");
const introImage = document.getElementById("intro-image");
let introState = "idle";

const fadeOutOverlay = () => {
  if (!overlay) return;
  overlay.style.transition = "opacity 0.8s ease-in-out";
  overlay.style.opacity = "0";
  setTimeout(() => overlay.remove(), 800);
};

if (overlay && introVideo) {
  const startIntroVideo = () => {
    if (introState !== "idle") return;
    introState = "playing";
    if (introImage) {
      introImage.style.transition = "opacity 0.4s ease";
      introImage.style.opacity = "0";
    }
    introVideo.play().catch(() => {
      introState = "idle";
    });
  };

  overlay.addEventListener("click", () => {
    startIntroVideo();
  });

  introVideo.addEventListener("timeupdate", () => {
    if (introState !== "playing") return;
    const remaining = introVideo.duration - introVideo.currentTime;
    if (remaining <= 0.8) {
      introState = "fading";
      fadeOutOverlay();
    }
  });

  introVideo.addEventListener("ended", () => {
    if (introState !== "fading") fadeOutOverlay();
  });

  startIntroVideo();
}

if (overlay && !introVideo) {
  overlay.addEventListener("click", fadeOutOverlay, { once: true });
  setTimeout(fadeOutOverlay, 300);
}

const audio = document.getElementById("bg-audio");
const audioToggle = document.getElementById("audio-toggle");
const audioOn = document.getElementById("audio-on");
const audioOff = document.getElementById("audio-off");
const AUDIO_TARGET_VOLUME = 0.5;

const setMuted = (muted) => {
  if (!audio) return;
  audio.muted = muted;
  if (audioOn) audioOn.classList.toggle("hidden", muted);
  if (audioOff) audioOff.classList.toggle("hidden", !muted);
  if (audioToggle) {
    audioToggle.setAttribute("aria-label", muted ? "Activar sonido" : "Silenciar");
  }
};

const startAudioWithFade = () => {
  if (!audio) return;
  audio.volume = 0;
  setMuted(false);
  return audio.play().then(() => {
    let volume = 0;
    const fade = setInterval(() => {
      volume += 0.017;
      if (volume >= AUDIO_TARGET_VOLUME) {
        audio.volume = AUDIO_TARGET_VOLUME;
        clearInterval(fade);
      } else {
        audio.volume = volume;
      }
    }, 100);
    return true;
  }).catch(() => {
    setMuted(true);
    return false;
  });
};

const startMutedAutoplayFallback = () => {
  if (!audio) return;
  setMuted(true);
  audio.volume = AUDIO_TARGET_VOLUME;
  return audio.play().then(() => true).catch(() => false);
};

const stopAudio = () => {
  if (!audio) return;
  audio.pause();
  setMuted(true);
};

if (audio) {
  setMuted(false);
}

if (audioToggle) {
  audioToggle.addEventListener("click", () => {
    if (!audio) return;
    if (audio.muted || audio.paused) {
      startAudioWithFade();
    } else {
      stopAudio();
    }
  });
}

if (overlay) {
  overlay.addEventListener("click", startAudioWithFade, { once: true });
}

// Try autoplay with sound on load. If blocked by browser policy, fallback to muted autoplay.
const attemptAutoStartAudio = () => {
  if (!audio) return;
  startAudioWithFade().then((startedWithSound) => {
    if (!startedWithSound) {
      startMutedAutoplayFallback();
    }
  });
};

attemptAutoStartAudio();

if (audio) {
  audio.addEventListener("canplay", () => {
    if (audio.paused) {
      attemptAutoStartAudio();
    }
  }, { once: true });
}

const targetDate = new Date(`${settings.weddingDate}T17:00:00-04:00`);
const countdownNodes = {
  days: document.querySelector('[data-unit="days"]'),
  hours: document.querySelector('[data-unit="hours"]'),
  minutes: document.querySelector('[data-unit="minutes"]'),
  seconds: document.querySelector('[data-unit="seconds"]'),
};

const updateCountdown = () => {
  if (!countdownNodes.days) return;
  const now = new Date();
  const diff = targetDate.getTime() - now.getTime();

  if (Number.isNaN(targetDate.getTime()) || diff <= 0) {
    Object.values(countdownNodes).forEach((node) => {
      if (node) node.textContent = "00";
    });
    return;
  }

  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (countdownNodes.days) countdownNodes.days.textContent = String(days).padStart(2, "0");
  if (countdownNodes.hours) countdownNodes.hours.textContent = String(hours).padStart(2, "0");
  if (countdownNodes.minutes) countdownNodes.minutes.textContent = String(minutes).padStart(2, "0");
  if (countdownNodes.seconds) countdownNodes.seconds.textContent = String(seconds).padStart(2, "0");
};

updateCountdown();
setInterval(updateCountdown, 1000);

const accordionButtons = document.querySelectorAll("[data-accordion-button]");
accordionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const parent = button.closest("div");
    if (!parent) return;
    const content = parent.querySelector("[data-accordion-content]");
    if (!content) return;
    const isHidden = content.hasAttribute("hidden");
    document.querySelectorAll("[data-accordion-content]").forEach((node) => {
      node.setAttribute("hidden", "");
    });
    if (isHidden) content.removeAttribute("hidden");
  });
});

const attendanceInputs = document.querySelectorAll("input[name=\"attendance\"]");
const attendanceSections = document.querySelectorAll("[data-attendance=\"yes\"]");
const withPartnerInputs = document.querySelectorAll("input[name=\"with-partner\"]");
const withPartnerBlock = document.getElementById("with-partner-block");
const partnerFields = document.getElementById("partner-fields");
const partnerDietaryFields = document.getElementById("partner-dietary-fields");
const partnerOtherField = document.getElementById("partner-other-field");
const partnerNameInput = document.getElementById("partner-name");
let forceSoloGuest = false;

const isWithPartner = () => {
  if (forceSoloGuest) return false;
  const selected = document.querySelector("input[name=\"with-partner\"]:checked");
  return selected ? selected.value === "yes" : false;
};

const updatePartnerFields = () => {
  const showPartner = isWithPartner();
  if (partnerFields) partnerFields.classList.toggle("hidden", !showPartner);
  if (partnerDietaryFields) partnerDietaryFields.classList.toggle("hidden", !showPartner);
  if (partnerOtherField) partnerOtherField.classList.toggle("hidden", !showPartner);
};

const updateAttendance = (value) => {
  const show = value === "yes";
  attendanceSections.forEach((section) => {
    section.classList.toggle("hidden", !show);
  });
  if (!show) {
    if (partnerFields) partnerFields.classList.add("hidden");
    if (partnerDietaryFields) partnerDietaryFields.classList.add("hidden");
    if (partnerOtherField) partnerOtherField.classList.add("hidden");
    return;
  }
  if (withPartnerBlock) {
    withPartnerBlock.classList.toggle("hidden", forceSoloGuest);
  }
  if (forceSoloGuest) {
    clearPartnerData();
  }
  updatePartnerFields();
};

attendanceInputs.forEach((input) => {
  input.addEventListener("change", (event) => {
    updateAttendance(event.target.value);
  });
});

withPartnerInputs.forEach((input) => {
  input.addEventListener("change", updatePartnerFields);
});

const rsvpForm = document.getElementById("rsvp-form");
const rsvpSection = document.getElementById("rsvp");
const confirmationSection = document.getElementById("rsvp-confirmation");
const confirmationTitle = document.getElementById("confirmation-title");
const confirmationMessage = document.getElementById("confirmation-message");
const calendarBlock = document.getElementById("calendar-block");
const addToCalendar = document.getElementById("add-to-calendar");
const rsvpVideoOverlay = document.getElementById("rsvp-video-overlay");
const rsvpVideo = document.getElementById("rsvp-video");
const rsvpVideoFade = document.getElementById("rsvp-video-fade");
const nameInput = document.getElementById("name");
const emailInput = document.getElementById("email");
const songInput = document.getElementById("song");
const messageInput = document.getElementById("message");
const dietaryOtherInput = document.getElementById("dietary-other");
const partnerDietaryOtherInput = document.getElementById("partner-dietary-other");
const dietarySelfOptions = document.getElementById("dietary-self-options");
const dietaryPartnerOptions = document.getElementById("dietary-partner-options");
const rsvpSubmitButton = rsvpForm ? rsvpForm.querySelector("button[type=\"submit\"]") : null;
const photoUploadSection = document.getElementById("photo-upload");
const photoUploadForm = document.getElementById("photo-upload-form");
const photoUploadNameInput = document.getElementById("photo-upload-name");
const photoUploadFilesInput = document.getElementById("photo-upload-files");
const photoUploadCommentInput = document.getElementById("photo-upload-comment");
const photoUploadNotice = document.getElementById("photo-upload-notice");
const photoUploadSubmitButton = photoUploadForm ? photoUploadForm.querySelector("button[type=\"submit\"]") : null;
const photoPreviewWrap = document.getElementById("photo-preview-wrap");
const photoPreviewCount = document.getElementById("photo-preview-count");
const photoPreviewAdd = document.getElementById("photo-preview-add");
const photoPreviewViewport = document.getElementById("photo-preview-viewport");
const photoPreviewTrack = document.getElementById("photo-preview-track");
const photoPreviewPrev = document.getElementById("photo-preview-prev");
const photoPreviewNext = document.getElementById("photo-preview-next");
const photoLightbox = document.getElementById("photo-lightbox");
const photoLightboxImage = document.getElementById("photo-lightbox-image");
const photoLightboxClose = document.getElementById("photo-lightbox-close");

const PHOTO_UPLOAD_LIMITS = {
  maxFiles: 10,
  maxFileSizeBytes: 8 * 1024 * 1024,
  maxTotalSizeBytes: 30 * 1024 * 1024,
};

let isRsvpEnabled = true;
let isPhotoUploadEnabled = false;
let photoPreviewUrls = [];
let selectedPhotoFiles = [];

const toBooleanFlag = (value) => {
  if (value === true) return true;
  if (typeof value === "number") return value !== 0;
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "si" || normalized === "sí" || normalized === "yes";
};

const getAccessSessionData = () => {
  try {
    const raw = sessionStorage.getItem(ACCESS_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (error) {
    return null;
  }
};

const clearPartnerData = () => {
  const noPartnerInput = document.querySelector("input[name=\"with-partner\"][value=\"no\"]");
  if (noPartnerInput) noPartnerInput.checked = true;
  if (partnerNameInput) partnerNameInput.value = "";
  if (partnerDietaryOtherInput) partnerDietaryOtherInput.value = "";
  if (dietaryPartnerOptions) {
    const checked = dietaryPartnerOptions.querySelectorAll("input[type=\"checkbox\"]:checked");
    checked.forEach((input) => {
      input.checked = false;
    });
  }
};

const applyGuestFormMode = () => {
  if (withPartnerBlock) {
    withPartnerBlock.classList.toggle("hidden", forceSoloGuest);
  }
  if (forceSoloGuest) {
    clearPartnerData();
  }
  updatePartnerFields();
};

const applySiteSettings = async () => {
  const siteSettings = await siteSettingsPromise;

  if (siteSettings.habilitar_codigo_acceso) {
    const accessSession = getAccessSessionData();
    if (!accessSession) {
      window.location.replace("index.html");
      return false;
    }
    forceSoloGuest = toBooleanFlag(accessSession.solo);
    if (nameInput && !nameInput.value && accessSession.invitado) {
      nameInput.value = String(accessSession.invitado).trim();
    }
  } else {
    forceSoloGuest = false;
  }

  isRsvpEnabled = siteSettings.habilitar_rsvp;
  if (!isRsvpEnabled) {
    if (rsvpSection) rsvpSection.classList.add("hidden");
    if (heroCta) heroCta.classList.add("hidden");
  }

  isPhotoUploadEnabled = siteSettings.habilitar_subida_fotos === true;
  if (photoUploadSection) {
    photoUploadSection.classList.toggle("hidden", !isPhotoUploadEnabled);
  }

  applyGuestFormMode();
  return true;
};

applySiteSettings();

const getCheckedValues = (container) => {
  if (!container) return [];
  return Array.from(container.querySelectorAll("input[type=\"checkbox\"]:checked"))
    .map((input) => input.value.trim())
    .filter((value) => value.length > 0);
};

const buildRsvpPayload = (attendanceValue) => {
  const withPartner = attendanceValue === "yes" ? isWithPartner() : false;
  const asistencia = attendanceValue === "yes" ? "si" : "no";

  return {
    action: "rsvp",
    enviadoEnIso: new Date().toISOString(),
    asistencia,
    nombre: nameInput ? nameInput.value.trim() : "",
    correo: emailInput ? emailInput.value.trim() : "",
    conAcompanante: withPartner,
    nombreAcompanante: withPartner && partnerNameInput ? partnerNameInput.value.trim() : "",
    restriccionesAlimentarias: attendanceValue === "yes" ? getCheckedValues(dietarySelfOptions) : [],
    otrasRestricciones: attendanceValue === "yes" && dietaryOtherInput ? dietaryOtherInput.value.trim() : "",
    restriccionesAlimentariasAcompanante: withPartner ? getCheckedValues(dietaryPartnerOptions) : [],
    otrasRestriccionesAcompanante: withPartner && partnerDietaryOtherInput ? partnerDietaryOtherInput.value.trim() : "",
    cancionSugerida: attendanceValue === "yes" && songInput ? songInput.value.trim() : "",
    mensaje: messageInput ? messageInput.value.trim() : "",
  };
};

const submitApiPayload = async (payload, defaultErrorMessage) => {
  if (!rsvpApiUrl) {
    throw new Error("Configura RSVP_API_URL en rsvp-config.js");
  }

  const apiUrl = rsvpApiUrl.trim();
  const body = JSON.stringify(payload);

  const submitViaHiddenForm = () => new Promise((resolve, reject) => {
    const iframeName = `rsvp-submit-${Date.now()}`;
    const iframe = document.createElement("iframe");
    iframe.name = iframeName;
    iframe.style.display = "none";

    const form = document.createElement("form");
    form.method = "POST";
    form.action = apiUrl;
    form.target = iframeName;
    form.style.display = "none";

    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "payload";
    input.value = body;
    form.appendChild(input);

    let settled = false;
    const cleanup = () => {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      if (form.parentNode) form.parentNode.removeChild(form);
    };

    const done = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve({ ok: true });
    };

    const fail = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error("No se pudo conectar con Google Sheets."));
    };

    iframe.addEventListener("load", done, { once: true });
    setTimeout(done, 1800);
    setTimeout(fail, 8000);

    document.body.appendChild(iframe);
    document.body.appendChild(form);
    form.submit();
  });

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body,
    });

    const text = await response.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch (parseError) {
      data = {};
    }

    if (!response.ok || !data.ok) {
      const message = data && data.error ? data.error : defaultErrorMessage;
      const apiError = new Error(message);
      apiError.isApiError = true;
      throw apiError;
    }
    return data;
  } catch (error) {
    if (error && error.isApiError) {
      throw error;
    }
    return submitViaHiddenForm();
  }
};

const submitRsvp = async (payload) => submitApiPayload(payload, "No se pudo guardar la confirmacion.");

const setPhotoUploadNotice = (message, isError) => {
  if (!photoUploadNotice) return;
  photoUploadNotice.textContent = message || "";
  photoUploadNotice.style.color = isError ? "#9f1239" : "#3f5f5a";
};

const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => {
    if (typeof reader.result !== "string") {
      reject(new Error("No se pudo leer una foto."));
      return;
    }
    resolve(reader.result);
  };
  reader.onerror = () => reject(new Error("No se pudo leer una foto."));
  reader.readAsDataURL(file);
});

const buildPhotoFilePayloads = async (files) => {
  if (!Array.isArray(files) || files.length === 0) {
    throw new Error("Debes adjuntar al menos una foto.");
  }

  if (files.length > PHOTO_UPLOAD_LIMITS.maxFiles) {
    throw new Error(`Puedes subir hasta ${PHOTO_UPLOAD_LIMITS.maxFiles} fotos por envio.`);
  }

  const totalBytes = files.reduce((acc, file) => acc + Number(file.size || 0), 0);
  if (totalBytes > PHOTO_UPLOAD_LIMITS.maxTotalSizeBytes) {
    throw new Error("El peso total supera el limite permitido (30 MB).");
  }

  const payloadFiles = [];
  for (let i = 0; i < files.length; i += 1) {
    const file = files[i];
    if (!file || typeof file.type !== "string" || !file.type.startsWith("image/")) {
      throw new Error("Solo se permiten imagenes.");
    }

    const fileSize = Number(file.size || 0);
    if (fileSize > PHOTO_UPLOAD_LIMITS.maxFileSizeBytes) {
      throw new Error("Cada foto debe pesar maximo 8 MB.");
    }

    const dataUrl = await readFileAsDataUrl(file);
    const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : "";
    if (!base64) {
      throw new Error("No se pudo procesar una foto seleccionada.");
    }

    payloadFiles.push({
      nombreArchivo: file.name || `foto-${i + 1}`,
      tipoMime: file.type || "application/octet-stream",
      tamanoBytes: fileSize,
      base64,
    });
  }

  return payloadFiles;
};

const submitPhotoUpload = async (payload) => submitApiPayload(payload, "No se pudieron subir las fotos.");
const getPhotoFileKey = (file) => `${file.name || "file"}::${Number(file.size || 0)}::${Number(file.lastModified || 0)}`;

const appendSelectedPhotoFiles = (incomingFiles) => {
  if (!Array.isArray(incomingFiles) || incomingFiles.length === 0) return;

  const seen = new Set(selectedPhotoFiles.map(getPhotoFileKey));
  let skippedNonImages = 0;

  incomingFiles.forEach((file) => {
    if (!file) return;
    if (typeof file.type !== "string" || !file.type.startsWith("image/")) {
      skippedNonImages += 1;
      return;
    }

    const fileKey = getPhotoFileKey(file);
    if (seen.has(fileKey)) return;
    seen.add(fileKey);
    selectedPhotoFiles.push(file);
  });

  if (selectedPhotoFiles.length > PHOTO_UPLOAD_LIMITS.maxFiles) {
    selectedPhotoFiles = selectedPhotoFiles.slice(0, PHOTO_UPLOAD_LIMITS.maxFiles);
    setPhotoUploadNotice(`Puedes subir hasta ${PHOTO_UPLOAD_LIMITS.maxFiles} fotos por envio.`, true);
  } else if (skippedNonImages > 0) {
    setPhotoUploadNotice("Se omitieron archivos que no son imágenes.", true);
  }

  renderPhotoPreview(selectedPhotoFiles);
};

const revokePhotoPreviewUrls = () => {
  photoPreviewUrls.forEach((url) => {
    try {
      URL.revokeObjectURL(url);
    } catch (error) {
      // Ignore invalid object URLs.
    }
  });
  photoPreviewUrls = [];
};

const closePhotoLightbox = () => {
  if (!photoLightbox) return;
  photoLightbox.classList.add("hidden");
  if (photoLightboxImage) {
    photoLightboxImage.removeAttribute("src");
  }
  document.body.style.overflow = "";
};

const openPhotoLightbox = (src) => {
  if (!photoLightbox || !photoLightboxImage || !src) return;
  photoLightboxImage.src = src;
  photoLightbox.classList.remove("hidden");
  document.body.style.overflow = "hidden";
};

const updatePhotoPreviewNavigation = () => {
  if (!photoPreviewViewport || !photoPreviewPrev || !photoPreviewNext) return;
  const maxScrollLeft = Math.max(photoPreviewViewport.scrollWidth - photoPreviewViewport.clientWidth, 0);
  const canScroll = maxScrollLeft > 1;

  photoPreviewPrev.style.visibility = canScroll ? "visible" : "hidden";
  photoPreviewNext.style.visibility = canScroll ? "visible" : "hidden";

  photoPreviewPrev.disabled = !canScroll || photoPreviewViewport.scrollLeft <= 1;
  photoPreviewNext.disabled = !canScroll || photoPreviewViewport.scrollLeft >= maxScrollLeft - 1;
};

const clearPhotoPreview = () => {
  revokePhotoPreviewUrls();
  if (photoPreviewTrack) {
    photoPreviewTrack.innerHTML = "";
  }
  if (photoPreviewCount) {
    photoPreviewCount.textContent = "";
  }
  if (photoPreviewWrap) {
    photoPreviewWrap.classList.add("hidden");
  }
  if (photoPreviewViewport) {
    photoPreviewViewport.scrollLeft = 0;
  }
  updatePhotoPreviewNavigation();
  closePhotoLightbox();
};

const resetPhotoSelection = () => {
  selectedPhotoFiles = [];
  clearPhotoPreview();
  if (photoUploadFilesInput) {
    photoUploadFilesInput.value = "";
  }
};

const renderPhotoPreview = (files) => {
  if (!photoPreviewWrap || !photoPreviewTrack || !photoPreviewCount) return;

  clearPhotoPreview();
  if (!Array.isArray(files) || files.length === 0) return;

  photoPreviewWrap.classList.remove("hidden");
  photoPreviewCount.textContent = `${files.length} foto${files.length === 1 ? "" : "s"} seleccionada${files.length === 1 ? "" : "s"}`;

  files.forEach((file, index) => {
    const objectUrl = URL.createObjectURL(file);
    photoPreviewUrls.push(objectUrl);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "photo-preview-thumb";
    button.setAttribute("aria-label", `Ver foto ${index + 1} en grande`);

    const img = document.createElement("img");
    img.src = objectUrl;
    img.alt = `Previsualización ${index + 1}`;
    img.loading = "lazy";
    img.decoding = "async";

    button.appendChild(img);
    button.addEventListener("click", () => openPhotoLightbox(objectUrl));
    photoPreviewTrack.appendChild(button);
  });

  requestAnimationFrame(updatePhotoPreviewNavigation);
};

const openCalendar = () => {
  const title = `${settings.couple1} & ${settings.couple2} - Boda`;
  const location = `${settings.venue}, ${settings.location}`;
  const details = `Celebración de ${settings.couple1} y ${settings.couple2}`;
  const date = settings.weddingDate.replace(/-/g, "");
  const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${date}/${date}&location=${encodeURIComponent(location)}&details=${encodeURIComponent(details)}`;
  window.open(url, "_blank");
};

if (addToCalendar) {
  addToCalendar.addEventListener("click", openCalendar);
}

const showConfirmation = (attendance) => {
  if (!confirmationSection || !confirmationTitle || !confirmationMessage) return;
  const dateText = "2 de mayo de 2026";
  const locationText = `${settings.venue}, ${settings.location}`;

  if (attendance === "no") {
    confirmationTitle.textContent = "Gracias";
    confirmationMessage.textContent =
      "Sentimos que no puedas acompañarnos. Te tendremos presente en este día tan especial.";
    if (calendarBlock) calendarBlock.classList.add("hidden");
  } else {
    confirmationTitle.textContent = "Gracias por confirmar";
    confirmationMessage.textContent = `Nos vemos el ${dateText} en ${locationText}.`;
    if (calendarBlock) calendarBlock.classList.remove("hidden");
  }

  if (rsvpSection) rsvpSection.classList.add("hidden");
  confirmationSection.classList.remove("hidden");
  confirmationSection.scrollIntoView({ behavior: "smooth" });
};

const playConfirmationVideo = () => {
  if (!rsvpVideoOverlay || !rsvpVideo || !rsvpVideoFade) {
    showConfirmation("yes");
    return;
  }

  rsvpVideoOverlay.classList.remove("hidden");
  rsvpVideoOverlay.classList.add("flex");
  rsvpVideoFade.style.opacity = "0";
  rsvpVideoFade.style.transition = "opacity 1.5s ease-in-out";

  const handleTimeUpdate = () => {
    if (rsvpVideo.duration - rsvpVideo.currentTime <= 1.5) {
      rsvpVideoFade.style.opacity = "1";
    }
  };

  const handleEnd = () => {
    rsvpVideo.removeEventListener("timeupdate", handleTimeUpdate);
    rsvpVideoOverlay.classList.add("hidden");
    rsvpVideoOverlay.classList.remove("flex");
    showConfirmation("yes");
  };

  rsvpVideo.addEventListener("timeupdate", handleTimeUpdate);
  rsvpVideo.addEventListener("ended", handleEnd, { once: true });
  rsvpVideo.play().catch(() => {
    rsvpVideoOverlay.classList.add("hidden");
    rsvpVideoOverlay.classList.remove("flex");
    showConfirmation("yes");
  });
};

if (rsvpForm) {
  rsvpForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!isRsvpEnabled) return;

    const attendance = document.querySelector("input[name=\"attendance\"]:checked");
    const attendanceValue = attendance ? attendance.value : "yes";

    if (attendanceValue === "yes") {
      if (isWithPartner() && partnerNameInput && partnerNameInput.value.trim() === "") {
        alert("Si vienes con pareja, ingresa su nombre completo.");
        return;
      }
    }

    const payload = buildRsvpPayload(attendanceValue);
    const originalText = rsvpSubmitButton ? rsvpSubmitButton.textContent : "";

    try {
      if (rsvpSubmitButton) {
        rsvpSubmitButton.disabled = true;
        rsvpSubmitButton.textContent = "Enviando...";
      }
      await submitRsvp(payload);
      if (attendanceValue === "yes") {
        playConfirmationVideo();
      } else {
        showConfirmation("no");
      }
    } catch (error) {
      alert(error && error.message ? error.message : "No se pudo enviar la confirmacion.");
    } finally {
      if (rsvpSubmitButton) {
        rsvpSubmitButton.disabled = false;
        rsvpSubmitButton.textContent = originalText || "Enviar confirmacion";
      }
    }
  });
}

if (photoUploadForm) {
  if (photoUploadFilesInput) {
    photoUploadFilesInput.addEventListener("change", () => {
      const newFiles = Array.from(photoUploadFilesInput.files || []);
      appendSelectedPhotoFiles(newFiles);
    });
  }

  if (photoPreviewAdd && photoUploadFilesInput) {
    photoPreviewAdd.addEventListener("click", () => {
      photoUploadFilesInput.value = "";
      photoUploadFilesInput.click();
    });
  }

  if (photoPreviewViewport) {
    photoPreviewViewport.addEventListener("scroll", updatePhotoPreviewNavigation, { passive: true });
  }

  if (photoPreviewPrev && photoPreviewViewport) {
    photoPreviewPrev.addEventListener("click", () => {
      photoPreviewViewport.scrollBy({ left: -260, behavior: "smooth" });
    });
  }

  if (photoPreviewNext && photoPreviewViewport) {
    photoPreviewNext.addEventListener("click", () => {
      photoPreviewViewport.scrollBy({ left: 260, behavior: "smooth" });
    });
  }

  if (photoLightboxClose) {
    photoLightboxClose.addEventListener("click", closePhotoLightbox);
  }

  if (photoLightbox) {
    photoLightbox.addEventListener("click", (event) => {
      if (event.target === photoLightbox) {
        closePhotoLightbox();
      }
    });
  }

  window.addEventListener("resize", updatePhotoPreviewNavigation);
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && photoLightbox && !photoLightbox.classList.contains("hidden")) {
      closePhotoLightbox();
    }
  });

  photoUploadForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!isPhotoUploadEnabled) return;

    const guestName = photoUploadNameInput ? photoUploadNameInput.value.trim() : "";
    const selectedFiles = selectedPhotoFiles.slice();
    const comment = photoUploadCommentInput ? photoUploadCommentInput.value.trim() : "";
    const originalText = photoUploadSubmitButton ? photoUploadSubmitButton.textContent : "";

    if (!guestName) {
      setPhotoUploadNotice("Ingresa tu nombre para continuar.", true);
      return;
    }

    try {
      if (photoUploadSubmitButton) {
        photoUploadSubmitButton.disabled = true;
        photoUploadSubmitButton.textContent = "Subiendo...";
      }
      setPhotoUploadNotice("Preparando fotos...", false);

      const photoPayload = await buildPhotoFilePayloads(selectedFiles);
      await submitPhotoUpload({
        action: "upload_photos",
        enviadoEnIso: new Date().toISOString(),
        nombre: guestName,
        comentario: comment,
        fotos: photoPayload,
      });

      setPhotoUploadNotice("Fotos enviadas con exito. Gracias por compartir este recuerdo.", false);
      photoUploadForm.reset();
      resetPhotoSelection();
      if (nameInput && nameInput.value.trim() && photoUploadNameInput && !photoUploadNameInput.value.trim()) {
        photoUploadNameInput.value = nameInput.value.trim();
      }
    } catch (error) {
      setPhotoUploadNotice(error && error.message ? error.message : "No se pudieron subir las fotos.", true);
    } finally {
      if (photoUploadSubmitButton) {
        photoUploadSubmitButton.disabled = false;
        photoUploadSubmitButton.textContent = originalText || "Enviar fotos";
      }
    }
  });
}

updateAttendance("yes");

const giftConfig = {
  apiUrl: typeof window !== "undefined" ? window.GIFT_API_URL || "" : "",
  idParam: typeof window !== "undefined" ? window.GIFT_ID_PARAM || "gift" : "gift",
  statusParam: typeof window !== "undefined" ? window.GIFT_STATUS_PARAM || "status" : "status",
  successValues: typeof window !== "undefined" && Array.isArray(window.GIFT_SUCCESS_VALUES)
    ? window.GIFT_SUCCESS_VALUES
    : ["paid", "approved", "success"],
};

const giftConfirmation = document.getElementById("gift-confirmation");
const giftConfirmationMessage = document.getElementById("gift-confirmation-message");
const giftConfirmationClose = document.getElementById("gift-confirmation-close");
const giftModal = document.getElementById("gift-modal");
const giftModalOpen = document.getElementById("gift-modal-open");
const giftModalDecline = document.getElementById("gift-modal-decline");
const giftModalClose = document.getElementById("gift-modal-close");
const giftSort = document.getElementById("gift-sort");
const giftGrid = document.querySelector(".gift-grid");
const giftPaymentModal = document.getElementById("gift-payment-modal");
const giftPaymentClose = document.getElementById("gift-payment-close");
const giftPaymentForm = document.getElementById("gift-payment-form");
const giftPaymentNameInput = document.getElementById("gift-payment-name");
const giftPaymentMessageInput = document.getElementById("gift-payment-message");
const giftPaymentConfirmedInput = document.getElementById("gift-payment-confirmed");
const giftPaymentSubmit = document.getElementById("gift-payment-submit");
const giftPaymentNotice = document.getElementById("gift-payment-notice");
const giftPaymentGiftName = document.getElementById("gift-payment-gift-name");

let giftCatalog = [];
let selectedGiftId = "";
let giftCatalogLoaded = false;
let giftCatalogLoadingPromise = null;
const GIFT_CACHE_KEY = "gift_catalog_cache_v1";
const GIFT_CACHE_TTL_MS = 5 * 60 * 1000;

const formatGiftPrice = (value) => {
  const amount = Number(value || 0);
  return `$${amount.toLocaleString("es-CL")}`;
};

const pickGiftValue = (record, keys) => {
  if (!record || !Array.isArray(keys)) return "";
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    if (Object.prototype.hasOwnProperty.call(record, key) && record[key] !== null && record[key] !== undefined) {
      return record[key];
    }
  }
  return "";
};

const normalizeGiftKey = (key) => String(key || "")
  .trim()
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9]/g, "");

const pickGiftValueLoose = (record, keys) => {
  const direct = pickGiftValue(record, keys);
  if (String(direct || "").trim()) return direct;
  if (!record || typeof record !== "object" || !Array.isArray(keys)) return direct;

  const map = {};
  Object.keys(record).forEach((key) => {
    map[normalizeGiftKey(key)] = record[key];
  });

  for (let i = 0; i < keys.length; i += 1) {
    const normalized = normalizeGiftKey(keys[i]);
    if (Object.prototype.hasOwnProperty.call(map, normalized)) {
      const value = map[normalized];
      if (value !== null && value !== undefined) return value;
    }
  }

  return direct;
};

const parseGiftNumber = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const raw = String(value || "").trim();
  if (!raw) return 0;

  let cleaned = raw.replace(/\s/g, "").replace(/[^\d,.-]/g, "");
  if (!cleaned) return 0;

  const commaIndex = cleaned.lastIndexOf(",");
  const dotIndex = cleaned.lastIndexOf(".");
  if (commaIndex >= 0 && dotIndex >= 0) {
    if (commaIndex > dotIndex) {
      cleaned = cleaned.replace(/\./g, "").replace(",", ".");
    } else {
      cleaned = cleaned.replace(/,/g, "");
    }
  } else if (commaIndex >= 0) {
    const commaCount = (cleaned.match(/,/g) || []).length;
    if (commaCount > 1) {
      cleaned = cleaned.replace(/,/g, "");
    } else {
      const parts = cleaned.split(",");
      if (parts.length === 2 && parts[1].length === 3) {
        cleaned = `${parts[0]}${parts[1]}`;
      } else {
        cleaned = `${parts[0]}.${parts[1] || ""}`;
      }
    }
  } else if (dotIndex >= 0) {
    const dotCount = (cleaned.match(/\./g) || []).length;
    if (dotCount > 1) {
      cleaned = cleaned.replace(/\./g, "");
    } else {
      const parts = cleaned.split(".");
      if (parts.length === 2 && parts[1].length === 3) {
        cleaned = `${parts[0]}${parts[1]}`;
      }
    }
  }

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseGiftStock = (value) => {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const parsed = parseGiftNumber(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeGiftUrl = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^www\./i.test(raw)) return `https://${raw}`;
  return raw;
};

const normalizeGiftRecord = (record) => ({
  id: String(pickGiftValueLoose(record, ["id", "giftId", "gift_id"]) || "").trim(),
  name: String(pickGiftValueLoose(record, ["name", "regalo", "nombre", "titulo"]) || "").trim(),
  description: String(pickGiftValueLoose(record, ["description", "descripcion", "detalle"]) || "").trim(),
  price: parseGiftNumber(pickGiftValueLoose(record, ["price", "precio", "monto", "valor", "importe"])),
  stock: parseGiftStock(pickGiftValueLoose(record, ["stock", "cantidad_disponible", "cantidad", "disponibles", "cupos"])),
  imageUrl: normalizeGiftUrl(pickGiftValueLoose(record, ["imageUrl", "imagen_url", "image_url", "imagenUrl", "url_imagen", "image"])),
  paymentUrl: normalizeGiftUrl(pickGiftValueLoose(record, ["paymentUrl", "link_pago", "payment_url", "url_pago", "linkPago"])),
});

const normalizeGiftPayload = (payload) => {
  const parseValuesTable = (matrix) => {
    if (!Array.isArray(matrix) || matrix.length < 2 || !Array.isArray(matrix[0])) return [];
    const headers = matrix[0].map((header) => String(header || ""));
    return matrix
      .slice(1)
      .map((row) => {
        const item = {};
        headers.forEach((header, index) => {
          item[header] = Array.isArray(row) ? row[index] : "";
        });
        return normalizeGiftRecord(item);
      })
      .filter((gift) => gift.id);
  };

  if (Array.isArray(payload)) {
    return payload.map(normalizeGiftRecord).filter((gift) => gift.id);
  }

  if (payload && Array.isArray(payload.values)) {
    return parseValuesTable(payload.values);
  }

  if (payload && Array.isArray(payload.gifts)) {
    return payload.gifts.map(normalizeGiftRecord).filter((gift) => gift.id);
  }

  if (payload && payload.data && Array.isArray(payload.data.gifts)) {
    return payload.data.gifts.map(normalizeGiftRecord).filter((gift) => gift.id);
  }

  if (payload && payload.data && Array.isArray(payload.data.values)) {
    return parseValuesTable(payload.data.values);
  }

  if (payload && payload.data && typeof payload.data === "object") {
    return Object.keys(payload.data)
      .filter((id) => payload.data[id] && typeof payload.data[id] === "object")
      .map((id) => normalizeGiftRecord({ id, ...payload.data[id] }))
      .filter((gift) => gift.id);
  }

  if (payload && typeof payload === "object") {
    const metaKeys = new Set(["ok", "error", "message", "status"]);
    return Object.keys(payload)
      .filter((id) => !metaKeys.has(id))
      .filter((id) => payload[id] && typeof payload[id] === "object")
      .map((id) => normalizeGiftRecord({ id, ...payload[id] }))
      .filter((gift) => gift.id);
  }

  return [];
};

const readGiftCatalogCache = () => {
  try {
    const raw = window.localStorage.getItem(GIFT_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.gifts) || !parsed.savedAt) return [];
    if ((Date.now() - Number(parsed.savedAt)) > GIFT_CACHE_TTL_MS) return [];
    return parsed.gifts.map(normalizeGiftRecord).filter((gift) => gift.id);
  } catch (error) {
    return [];
  }
};

const writeGiftCatalogCache = (gifts) => {
  try {
    window.localStorage.setItem(GIFT_CACHE_KEY, JSON.stringify({
      gifts,
      savedAt: Date.now(),
    }));
  } catch (error) {
    // Ignore storage errors.
  }
};

const buildGiftCardHtml = (gift) => {
  const hasStock = Number.isFinite(gift.stock);
  const isSoldOut = hasStock && gift.stock <= 0;
  const stockText = isSoldOut ? "Agotado" : (hasStock ? `Disponibles: ${gift.stock}` : "Disponible");
  const buttonLabel = "Regalar &#10084;&#65038;";
  const ctaLabel = "Ir a regalar";
  const ctaDisabledClass = isSoldOut ? " is-disabled" : "";
  const imageMarkup = gift.imageUrl
    ? `<img class="gift-image" src="${gift.imageUrl}" alt="${gift.name}" loading="lazy" />`
    : "";
  const descriptionMarkup = gift.description
    ? `<p class="gift-description">${gift.description}</p>`
    : "<p>Regalo disponible para contribuir.</p>";
  const actionMarkup = (!isSoldOut && gift.paymentUrl)
    ? `<a class="gift-link" href="${gift.paymentUrl}" target="_blank" rel="noopener noreferrer">${buttonLabel}</a>`
    : `<button class="gift-link" type="button" disabled>${buttonLabel}</button>`;

  return `
    <details class="gift-card" data-gift-id="${gift.id}" data-gift-name="${gift.name}">
      <summary class="gift-summary">
        <span class="gift-icon"><span class="material-symbols-outlined">redeem</span></span>
        <span class="gift-title">${gift.name}</span>
        <span class="gift-amount">${formatGiftPrice(gift.price)}</span>
        <span class="gift-inline-availability" data-gift-availability>${stockText}</span>
        <span class="gift-inline-cta${ctaDisabledClass}">
          ${ctaLabel}
          <span class="material-symbols-outlined gift-inline-cta-arrow">keyboard_arrow_down</span>
        </span>
      </summary>
      <div class="gift-body">
        ${imageMarkup}
        ${descriptionMarkup}
        ${actionMarkup}
      </div>
    </details>
  `;
};

const sortGiftList = (list, mode) => {
  const sorted = [...list];
  if (mode === "price-asc") {
    sorted.sort((a, b) => a.price - b.price);
    return sorted;
  }
  if (mode === "price-desc") {
    sorted.sort((a, b) => b.price - a.price);
    return sorted;
  }
  return sorted;
};

const setGiftPaymentNotice = (message, isError) => {
  if (!giftPaymentNotice) return;
  giftPaymentNotice.textContent = message || "";
  giftPaymentNotice.style.color = isError ? "#9f1239" : "#3f5f5a";
};

const renderGiftGrid = () => {
  if (!giftGrid) return;
  const mode = giftSort ? giftSort.value : "default";
  const gifts = sortGiftList(giftCatalog, mode);

  if (gifts.length === 0) {
    giftGrid.innerHTML = '<p class="text-sage-dark/70 font-body">No hay regalos disponibles por ahora.</p>';
    return;
  }

  giftGrid.innerHTML = gifts.map((gift) => buildGiftCardHtml(gift)).join("");
};

const loadGiftCatalog = async () => {
  if (!giftConfig.apiUrl || !giftGrid) return;
  if (giftCatalogLoadingPromise) return giftCatalogLoadingPromise;

  if (!giftCatalogLoaded && giftCatalog.length === 0) {
    const cachedGifts = readGiftCatalogCache();
    if (cachedGifts.length > 0) {
      giftCatalog = cachedGifts;
      giftCatalogLoaded = true;
      renderGiftGrid();
    }
  }

  giftCatalogLoadingPromise = (async () => {
  try {
    const response = await fetch(giftConfig.apiUrl, { cache: "no-store" });
    if (!response.ok) throw new Error("No se pudo cargar el catalogo de regalos.");
    const payload = await response.json();
    giftCatalog = normalizeGiftPayload(payload);
    giftCatalogLoaded = true;
    writeGiftCatalogCache(giftCatalog);
    renderGiftGrid();
  } catch (error) {
    if (giftCatalog.length === 0) {
      giftCatalog = [];
      giftGrid.innerHTML = '<p class="text-sage-dark/70 font-body">No se pudo cargar la lista de regalos desde Google Sheets.</p>';
    }
  } finally {
    giftCatalogLoadingPromise = null;
  }
  })();

  return giftCatalogLoadingPromise;
};

const submitGiftPaymentConfirmation = async (payload) => {
  if (!giftConfig.apiUrl) throw new Error("Configura GIFT_API_URL en gift-config.js");
  const response = await fetch(giftConfig.apiUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok || !data.ok) {
    throw new Error(data && data.error ? data.error : "No se pudo registrar la confirmación del regalo.");
  }
  return data;
};

const showGiftConfirmation = (giftName) => {
  if (!giftConfirmation || !giftConfirmationMessage) return;
  giftConfirmationMessage.textContent = giftName
    ? `Hemos recibido tu regalo: ${giftName}. ¡Muchas gracias!`
    : "Hemos recibido tu regalo. ¡Muchas gracias!";
  giftConfirmation.classList.remove("hidden");
};

const params = new URLSearchParams(window.location.search);
const giftStatus = params.get(giftConfig.statusParam);
const giftIdParam = params.get(giftConfig.idParam);
if (giftStatus && giftConfig.successValues.includes(giftStatus) && giftIdParam) {
  showGiftConfirmation(giftIdParam);
}

if (giftConfirmationClose) {
  giftConfirmationClose.addEventListener("click", () => {
    if (giftConfirmation) giftConfirmation.classList.add("hidden");
  });
}

const openGiftModal = () => {
  if (!giftModal) return;
  giftModal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  if (!giftCatalogLoaded && giftCatalog.length === 0 && giftGrid) {
    giftGrid.innerHTML = '<p class="text-sage-dark/70 font-body">Cargando regalos...</p>';
  }
  loadGiftCatalog().catch(() => {});
};

const closeGiftModal = () => {
  if (!giftModal) return;
  giftModal.classList.add("hidden");
  document.body.style.overflow = "";
};

const openGiftPaymentModal = (giftId) => {
  const gift = giftCatalog.find((item) => item.id === giftId);
  const hasStock = gift && Number.isFinite(gift.stock);
  const isSoldOut = hasStock && gift.stock <= 0;
  if (!gift || isSoldOut || !giftPaymentModal) return;

  selectedGiftId = giftId;
  if (giftPaymentGiftName) giftPaymentGiftName.textContent = gift.name;
  if (giftPaymentForm) giftPaymentForm.reset();
  setGiftPaymentNotice("", false);
  giftPaymentModal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
};

const closeGiftPaymentModal = () => {
  if (!giftPaymentModal) return;
  giftPaymentModal.classList.add("hidden");
  selectedGiftId = "";
  setGiftPaymentNotice("", false);
  if (giftModal && !giftModal.classList.contains("hidden")) {
    document.body.style.overflow = "hidden";
  } else {
    document.body.style.overflow = "";
  }
};

if (giftModalOpen) {
  giftModalOpen.addEventListener("click", openGiftModal);
}

if (giftModalDecline) {
  giftModalDecline.addEventListener("click", closeGiftModal);
}

if (giftModalClose) {
  giftModalClose.addEventListener("click", closeGiftModal);
}

if (giftSort) {
  giftSort.addEventListener("change", () => {
    renderGiftGrid();
  });
}

if (giftModal) {
  giftModal.addEventListener("click", (event) => {
    if (event.target === giftModal) closeGiftModal();
  });
}

if (giftGrid) {
  giftGrid.addEventListener("click", (event) => {
    const target = event.target;
    if (!target || typeof target.closest !== "function") return;
    const button = target.closest("[data-gift-select]");
    if (!button) return;
    const giftId = button.getAttribute("data-gift-select");
    if (!giftId) return;
    openGiftPaymentModal(giftId);
  });
}

if (giftPaymentClose) {
  giftPaymentClose.addEventListener("click", closeGiftPaymentModal);
}

if (giftPaymentModal) {
  giftPaymentModal.addEventListener("click", (event) => {
    if (event.target === giftPaymentModal) closeGiftPaymentModal();
  });
}

if (giftPaymentForm) {
  giftPaymentForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const gift = giftCatalog.find((item) => item.id === selectedGiftId);
    if (!gift) {
      setGiftPaymentNotice("Selecciona un regalo válido.", true);
      return;
    }

    const guestName = giftPaymentNameInput ? giftPaymentNameInput.value.trim() : "";
    const message = giftPaymentMessageInput ? giftPaymentMessageInput.value.trim() : "";
    const isConfirmed = giftPaymentConfirmedInput ? giftPaymentConfirmedInput.checked : false;

    if (!guestName) {
      setGiftPaymentNotice("Ingresa tu nombre para confirmar.", true);
      return;
    }

    if (!isConfirmed) {
      setGiftPaymentNotice("Debes confirmar que realizaste el pago.", true);
      return;
    }

    if (!gift.paymentUrl) {
      setGiftPaymentNotice("Este regalo no tiene link de pago configurado en Google Sheets.", true);
      return;
    }

    const originalText = giftPaymentSubmit ? giftPaymentSubmit.textContent : "";

    try {
      if (giftPaymentSubmit) {
        giftPaymentSubmit.disabled = true;
        giftPaymentSubmit.textContent = "Confirmando...";
      }

      const result = await submitGiftPaymentConfirmation({
        action: "gift_payment_confirm",
        enviadoEnIso: new Date().toISOString(),
        giftId: gift.id,
        nombre: guestName,
        mensaje: message,
      });

      if (typeof result.remaining === "number") {
        gift.stock = Math.max(0, result.remaining);
      } else if (Number.isFinite(gift.stock)) {
        gift.stock = Math.max(0, gift.stock - 1);
      }

      renderGiftGrid();
      closeGiftPaymentModal();
      closeGiftModal();
      showGiftConfirmation(gift.name);

      const redirectUrl = String(result && result.paymentUrl ? result.paymentUrl : gift.paymentUrl || "").trim();
      if (redirectUrl) {
        window.open(redirectUrl, "_blank", "noopener,noreferrer");
      }
    } catch (error) {
      setGiftPaymentNotice(error && error.message ? error.message : "No se pudo confirmar el regalo.", true);
    } finally {
      if (giftPaymentSubmit) {
        giftPaymentSubmit.disabled = false;
        giftPaymentSubmit.textContent = originalText || "Confirmar pago e ir a pagar";
      }
    }
  });
}

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && giftPaymentModal && !giftPaymentModal.classList.contains("hidden")) {
    closeGiftPaymentModal();
    return;
  }
  if (event.key === "Escape" && giftModal && !giftModal.classList.contains("hidden")) {
    closeGiftModal();
  }
});

if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
  window.requestIdleCallback(() => {
    loadGiftCatalog().catch(() => {});
  }, { timeout: 1200 });
} else {
  window.setTimeout(() => {
    loadGiftCatalog().catch(() => {});
  }, 150);
}










