// Enlaces al repositorio. Cambia BRANCH a 'Principal' cuando la rama Beta se fusione.
export const REPO_URL = 'https://github.com/AlejandroDukesini/DC-CHATBOT';
export const BRANCH = 'Beta';
export const treeUrl = (path = '') => `${REPO_URL}/tree/${BRANCH}/${path}`;
export const README_URL = `${REPO_URL}/blob/${BRANCH}/README.md`;
