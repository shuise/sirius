/**
 * Feature registry — all features register here.
 * Each module exports { name, defaultEnabled, init, destroy }
 * where init(pageState) is called when enabled, destroy() when disabled.
 */

const features = new Map();

export function register(feature) {
  features.set(feature.name, feature);
}

export function getFeature(name) {
  return features.get(name);
}

export function getAllFeatures() {
  return Array.from(features.values());
}

/**
 * pageState shared across features
 * { url, title, body }
 */
let pageState = { url: '', title: '', body: null };

export function getPageState() {
  return pageState;
}

export function updatePageState() {
  pageState = {
    url: location.href,
    title: document.title,
    body: document.body,
  };
}
