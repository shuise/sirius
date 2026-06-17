export interface Feature {
  name: string
  defaultEnabled: boolean
  init: () => void
  destroy: () => void
}

const features = new Map<string, Feature>()

export function register(feature: Feature) {
  features.set(feature.name, feature)
}

export function getFeature(name: string) {
  return features.get(name)
}

export function getAllFeatures(): Feature[] {
  return Array.from(features.values())
}

let pageState = { url: "", title: "", body: null as HTMLElement | null }

export function getPageState() {
  return pageState
}

export function updatePageState() {
  pageState = {
    url: location.href,
    title: document.title,
    body: document.body,
  }
}
