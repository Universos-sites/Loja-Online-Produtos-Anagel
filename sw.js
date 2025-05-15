const CACHE_NAME = "loja-online-cache-v1";
const URLS_TO_CACHE = [
  "/", // Alias for index.html
  "index.html",
  "style.css",
  // Adicione outros arquivos estáticos principais aqui (ex: script.js, logo.png)
  // Não adicione as imagens dos produtos aqui, pois são muitas e podem mudar.
  // O ideal é que o Service Worker intercepte os fetches para elas e as adicione ao cache dinamicamente.
];

// Evento de Instalação: Cacheia os arquivos principais
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("Service Worker: Cache aberto e arquivos principais cacheados na instalação.");
      return cache.addAll(URLS_TO_CACHE);
    })
  );
  self.skipWaiting(); // Força o SW a ativar imediatamente
});

// Evento de Ativação: Limpa caches antigos
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log("Service Worker: Cache antigo removido:", cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim(); // Permite que o SW controle clientes abertos imediatamente
});

// Evento Fetch: Intercepta as requisições de rede
self.addEventListener("fetch", (event) => {
  const requestUrl = new URL(event.request.url);

  // Para o index.html (ou a raiz "/"), tente sempre a rede primeiro.
  // Se a rede falhar (offline), sirva do cache.
  // Isso garante que o usuário veja o HTML mais recente se online.
  if (event.request.mode === "navigate" || requestUrl.pathname === "/" || requestUrl.pathname.endsWith("index.html")) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Se a resposta da rede for bem-sucedida, clone-a e coloque no cache
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          // Se a rede falhar, tente buscar no cache
          console.log("Service Worker: Falha na rede para", event.request.url, "servindo do cache.");
          return caches.match(event.request).then((cachedResponse) => {
            return cachedResponse || caches.match("index.html"); // Fallback para index.html se a URL específica não estiver no cache
          });
        })
    );
    return; // Importante para não prosseguir para a lógica de cache abaixo para navegação
  }

  // Para outros recursos (CSS, JS, imagens, etc.), use a estratégia Cache First, then Network.
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // console.log("Service Worker: Servindo do cache:", event.request.url);
        return cachedResponse;
      }

      // Se não estiver no cache, busque na rede
      return fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          // Clone a resposta e adicione ao cache para futuras requisições
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            // console.log("Service Worker: Cacheando novo recurso:", event.request.url);
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(error => {
        console.error("Service Worker: Erro ao buscar na rede e cachear:", error);
        // Você pode retornar uma resposta de fallback aqui se necessário (ex: imagem placeholder)
      });
    })
  );
});

