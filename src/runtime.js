export const runtime = {
  render() {},
  lock() {}
}

export function go(hash) {
  if (location.hash === hash) runtime.render()
  else location.hash = hash
}

export function lockNow() {
  runtime.lock()
}
