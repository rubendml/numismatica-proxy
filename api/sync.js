// api/sync.js - Proxy de sincronización

export default async function handler(req, res) {
  // Solo permite solicitudes POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  // === CONFIGURACIÓN (Tú debes llenar estos valores) ===
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN; // Usa variables de entorno
  const OWNER = 'rubendml';                     // Tu usuario de GitHub
  const REPO = 'numismatica';                   // Nombre de tu repositorio
  const PATH = req.body.path || 'data/coleccion.json'; // Ruta del archivo
  const BRANCH = 'main';                        // Puede ser 'main' o 'master'
  // ===================================================

  // Validación de token
  if (!GITHUB_TOKEN) {
    console.error('❌ GITHUB_TOKEN no está definido en las variables de entorno');
    return res.status(500).json({ error: 'Token de GitHub no configurado en el servidor' });
  }

  try {
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'No se proporcionó contenido' });
    }

    // Convertir a base64
    const encodedContent = Buffer.from(JSON.stringify(content, null, 2)).toString('base64');

    // Obtener SHA del archivo actual (necesario para actualizar)
    const fileUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${PATH}`;
    const fileRes = await fetch(fileUrl, {
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    let sha = null;
    if (fileRes.ok) {
      const fileData = await fileRes.json();
      sha = fileData.sha;
    } else if (fileRes.status !== 404) {
      const error = await fileRes.json();
      console.error('❌ Error al obtener el archivo:', error);
      return res.status(fileRes.status).json({ error: error.message });
    }

    // Hacer el commit
    const commitRes = await fetch(fileUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: `Sincronización automática - ${new Date().toLocaleString('es-ES')}`,
        content: encodedContent,
        sha,
        branch: BRANCH
      })
    });

    const result = await commitRes.json();

    if (commitRes.ok) {
      return res.status(200).json({
        success: true,
        message: 'Archivo actualizado correctamente en GitHub',
        commit: result.commit
      });
    } else {
      console.error('❌ Error en la API de GitHub:', result);
      return res.status(commitRes.status).json({
        success: false,
        error: result.message
      });
    }
  } catch (error) {
    console.error('❌ Error en el proxy:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
}
