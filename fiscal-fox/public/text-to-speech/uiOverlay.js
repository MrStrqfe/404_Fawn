let overlay = null;
let overlayInput = null;

function createMainOverlay() {
  overlay = document.createElement("div");

  overlay.style.position = "fixed";
  overlay.style.top = "0";
  overlay.style.left = "0";
  overlay.style.width = "100vw";
  overlay.style.height = "100vh";
  overlay.style.backgroundColor = "rgba(0,0,0,0.95)";
  overlay.style.color = "white";
  overlay.style.zIndex = "999999";
  overlay.style.display = "flex";
  overlay.style.flexDirection = "column";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.fontSize = "22px";
  overlay.style.textAlign = "center";
  overlay.style.padding = "40px";

  overlay.setAttribute("tabindex", "0");
  overlay.focus();

  overlay.innerHTML = `
    <div style="max-width: 700px;">
      <p>Fawn is available on this page.</p>
      <p style="margin-top: 20px;">
        Press <strong>SPACE</strong> to enable screen reader.
      </p>
      <p style="margin-top: 10px;">
        Press <strong>M</strong> to continue without enabling.
      </p>
      <p style="margin-top: 10px;">
        Press <strong>ESC</strong> to exit.
      </p>
    </div>
  `;

  document.body.appendChild(overlay);
}

function createKeywordOverlay() {
  overlay.innerHTML = `
    <div style="max-width: 700px;">
      <p>Type a keyword below.</p>
      <p style="font-size:16px; margin-bottom: 20px;">
        Press SPACE to confirm.
      </p>
    </div>
  `;

  overlayInput = document.createElement("input");
  overlayInput.type = "text";
  overlayInput.style.padding = "12px";
  overlayInput.style.fontSize = "18px";
  overlayInput.style.width = "60%";
  overlayInput.style.marginTop = "20px";
  overlayInput.style.borderRadius = "8px";
  overlayInput.style.border = "2px solid orange";

  overlay.appendChild(overlayInput);
  overlayInput.focus();
}

function updateOverlayMessage(message) {
  overlay.innerHTML = `
    <div style="max-width: 700px;">
      <p>${message}</p>
      <p style="margin-top:20px;">
        Press SPACE for next result.
      </p>
      <p style="margin-top:10px;">
        Press K for new keyword.
      </p>
      <p style="margin-top:10px;">
        Press ESC to exit.
      </p>
    </div>
  `;
}

function removeOverlay() {
  if (overlay) {
    overlay.remove();
    overlay = null;
    overlayInput = null;
  }
}
