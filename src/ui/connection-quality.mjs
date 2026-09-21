function numberLabel(value, suffix, digits = 1) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return "";
  return `${numeric.toFixed(digits).replace(/\.0$/, "")} ${suffix}`;
}

export function connectionQualityFromNetworkInformation(connection) {
  if (!connection) {
    return {
      level: "unknown",
      status: "Connection estimate unavailable",
      detail: "This browser does not expose a reliable connection estimate. YouTube will still adjust video quality automatically."
    };
  }

  if (connection.saveData === true) {
    return {
      level: "save-data",
      status: "Data saver is on",
      detail: "Your browser asks sites to reduce data use. YouTube may prefer lower video quality."
    };
  }

  const effectiveType = String(connection.effectiveType || "").toLowerCase();
  const downlink = Number(connection.downlink);
  const rtt = Number(connection.rtt);
  const parts = [
    effectiveType ? `${effectiveType.toUpperCase()} estimate` : "",
    numberLabel(downlink, "Mbps"),
    numberLabel(rtt, "ms latency", 0)
  ].filter(Boolean);

  const isPoor = ["slow-2g", "2g"].includes(effectiveType) || downlink > 0 && downlink < 0.75 || rtt >= 900;
  const isLimited = effectiveType === "3g" || downlink > 0 && downlink < 2.5 || rtt >= 300;

  if (isPoor) {
    return {
      level: "poor",
      status: "Poor connection",
      detail: `${parts.join(" · ")}. Video will likely use lower quality and may buffer.`
    };
  }

  if (isLimited) {
    return {
      level: "limited",
      status: "Limited connection",
      detail: `${parts.join(" · ")}. Video may start in lower quality or buffer.`
    };
  }

  return {
    level: "good",
    status: "Good connection",
    detail: `${parts.join(" · ")}. YouTube should be able to choose higher quality when available.`
  };
}

export function createConnectionQualityController({ navigator, elements } = {}) {
  const connection = navigator?.connection || navigator?.mozConnection || navigator?.webkitConnection || null;

  function render() {
    const quality = connectionQualityFromNetworkInformation(connection);
    if (elements?.status) elements.status.textContent = quality.status;
    if (elements?.detail) elements.detail.textContent = quality.detail;
    if (elements?.root) elements.root.dataset.connectionQuality = quality.level;
  }

  return {
    start() {
      render();
      connection?.addEventListener?.("change", render);
    },
    destroy() {
      connection?.removeEventListener?.("change", render);
    },
    render
  };
}
