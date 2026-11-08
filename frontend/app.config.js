// Toma app.json tal cual y solo le agrega google-services.json (Firebase) SI existe.
// Android lo necesita para recibir notificaciones push. Dos formas de dárselo, la que prefieras:
//   a) poner el archivo google-services.json en esta carpeta (y subirlo al repo), o
//   b) crear en EAS una variable de tipo "archivo" llamada GOOGLE_SERVICES_JSON.
// Si no hay ninguno, la app se compila igual; solo no llegarán los avisos de "tu pareja registró un gasto".
const fs = require('fs');

const archivo = process.env.GOOGLE_SERVICES_JSON || (fs.existsSync('./google-services.json') ? './google-services.json' : null);

module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    ...(archivo ? { googleServicesFile: archivo } : {}),
  },
});
