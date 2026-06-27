<?php
// ============================================================
// obtener_progreso.php
// Devuelve el progreso guardado + metadata del episodio
// ============================================================
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'mensaje' => 'Método no permitido. Usa GET.']);
    exit;
}

// ── Configuración PDO ────────────────────────────────────────
$host    = 'localhost';
$db      = 'podcast';
$user    = 'root';
$pass    = '';
$charset = 'utf8mb4';
$dsn     = "mysql:host=$host;dbname=$db;charset=$charset";

try {
    $pdo = new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ]);
} catch (\PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'status'  => 'error',
        'mensaje' => 'Error de conexión: ' . $e->getMessage(),
    ]);
    exit;
}

// ── Validar parámetros GET ───────────────────────────────────
$usuario_id  = isset($_GET['usuario_id'])  ? (int) $_GET['usuario_id']  : 0;
$episodio_id = isset($_GET['episodio_id']) ? (int) $_GET['episodio_id'] : 0;

if ($usuario_id <= 0 || $episodio_id <= 0) {
    http_response_code(422);
    echo json_encode([
        'status'  => 'error',
        'mensaje' => 'Parámetros inválidos. Se requieren usuario_id y episodio_id.',
    ]);
    exit;
}

// ── Consulta JOIN: progreso + metadata del episodio ─────────
try {
    $sql = '
        SELECT
            pp.tiempo_segundos,
            pp.ultima_escucha,
            e.titulo,
            e.artista,
            e.url_audio,
            e.duracion_segundos,
            e.color_disco,
            u.nombre AS nombre_usuario
        FROM progreso_podcast pp
        INNER JOIN episodios e ON e.id = pp.episodio_id
        INNER JOIN usuarios  u ON u.id = pp.usuario_id
        WHERE pp.usuario_id  = :usuario_id
          AND pp.episodio_id = :episodio_id
        LIMIT 1
    ';
    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        ':usuario_id'  => $usuario_id,
        ':episodio_id' => $episodio_id,
    ]);
    $row = $stmt->fetch();

    if ($row) {
        echo json_encode([
            'status'             => 'ok',
            'tiempo_segundos'    => (float) $row['tiempo_segundos'],
            'ultima_escucha'     => $row['ultima_escucha'],
            'titulo'             => $row['titulo'],
            'artista'            => $row['artista'],
            'url_audio'          => $row['url_audio'],
            'duracion_segundos'  => (int) $row['duracion_segundos'],
            'color_disco'        => $row['color_disco'],
            'nombre_usuario'     => $row['nombre_usuario'],
        ]);
    } else {
        // Sin progreso previo → devolver metadata del episodio con tiempo 0
        $sqlEp = 'SELECT titulo, artista, url_audio, duracion_segundos, color_disco FROM episodios WHERE id = :id LIMIT 1';
        $stmtEp = $pdo->prepare($sqlEp);
        $stmtEp->execute([':id' => $episodio_id]);
        $ep = $stmtEp->fetch();

        if ($ep) {
            echo json_encode([
                'status'             => 'nuevo',
                'tiempo_segundos'    => 0,
                'ultima_escucha'     => null,
                'titulo'             => $ep['titulo'],
                'artista'            => $ep['artista'],
                'url_audio'          => $ep['url_audio'],
                'duracion_segundos'  => (int) $ep['duracion_segundos'],
                'color_disco'        => $ep['color_disco'],
                'nombre_usuario'     => null,
            ]);
        } else {
            http_response_code(404);
            echo json_encode(['status' => 'error', 'mensaje' => 'Episodio no encontrado.']);
        }
    }

} catch (\PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'status'  => 'error',
        'mensaje' => 'Error al obtener progreso: ' . $e->getMessage(),
    ]);
}
