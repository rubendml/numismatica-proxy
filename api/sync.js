// numismatica-proxy/api/sync.js
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get('path') || 'data/catalogo.json';

  try {
    // === CONFIGURACIÓN ===
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const OWNER = 'rubendml';
    const REPO = 'numismatica';
    const BRANCH = 'main';

    if (!GITHUB_TOKEN) {
      console.error('❌ GITHUB_TOKEN no está definido');
      return NextResponse.json(
        { error: 'Token de GitHub no configurado en el servidor' },
        { status: 500 }
      );
    }

    const fileUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`;
    const response = await fetch(fileUrl, {
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error('❌ Error al obtener archivo:', error);
      return NextResponse.json(
        { error: error.message || 'No se pudo acceder al archivo' },
        { status: response.status }
      );
    }

    const data = await response.json();
    const content = Buffer.from(data.content, 'base64').toString('utf-8');
    const jsonData = JSON.parse(content);

    return NextResponse.json(jsonData);
  } catch (error) {
    console.error('❌ Error en el proxy:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const { path, content } = await request.json();

  if (!content) {
    return NextResponse.json(
      { error: 'No se proporcionó contenido' },
      { status: 400 }
    );
  }

  const targetPath = path || 'data/coleccion.json';
  const encodedContent = Buffer.from(JSON.stringify(content, null, 2)).toString('base64');

  const fileUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${targetPath}`;
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
    return NextResponse.json(
      { error: error.message },
      { status: fileRes.status }
    );
  }

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
    return NextResponse.json({
      success: true,
      message: 'Archivo actualizado correctamente en GitHub',
      commit: result.commit
    });
  } else {
    console.error('❌ Error en la API de GitHub:', result);
    return NextResponse.json({
      success: false,
      error: result.message
    }, { status: commitRes.status });
  }
}
