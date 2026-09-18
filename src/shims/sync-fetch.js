export default function unsupportedSynchronousFetch() {
  throw new Error("Synchronous network requests are disabled in the browser bundle.");
}
