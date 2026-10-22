/// <reference types="vite/client" />
declare module 'virtual:quistock-data' {
 const data: import('./data').Dataset|null;
 export default data;
}
