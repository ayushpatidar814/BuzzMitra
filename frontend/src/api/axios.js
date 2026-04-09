import axios from "axios"

const api = axios.create({
    baseURL: import.meta.env.VITE_BACKEND_URL,
    withCredentials: false,
})

const inflightGets = new Map()

const buildKey = (url, config = {}) =>
  JSON.stringify({
    url,
    params: config.params || {},
    headers: config.headers || {},
  })

api.getDedup = (url, config = {}) => {
  const key = buildKey(url, config)
  if (inflightGets.has(key)) {
    return inflightGets.get(key)
  }

  const request = api.get(url, config).finally(() => {
    inflightGets.delete(key)
  })
  inflightGets.set(key, request)
  return request
}

export default api;
