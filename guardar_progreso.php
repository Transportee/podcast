<?php
// ============================================================
// guardar_progreso.php
// Guarda / actualiza el progreso de reproducción via PDO
// ============================================================
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Preflight CORS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'mensaje' => 'Método no permitido. Usa POST.']);
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

// ── Leer y validar cuerpo JSON ───────────────────────────────
$body = json_decode(file_get_contents('php://input'), true);

// También aceptar application/x-www-form-urlencoded
if (empty($body)) {
    $body = $_POST;
}

$usuario_id  = isset($body['usuario_id'])      ? (int) $body['usuario_id']      : 0;
$episodio_id = isset($body['episodio_id'])      ? (int) $body['episodio_id']      : 0;
$tiempo      = isset($body['tiempo_segundos'])  ? (float) $body['tiempo_segundos'] : -1;

if ($usuario_id <= 0 || $episodio_id <= 0 || $tiempo < 0) {
    http_response_code(422);
    echo json_encode([
        'status'  => 'error',
        'mensaje' => 'Parámetros inválidos. Se requieren usuario_id, episodio_id y tiempo_segundos (≥ 0).',
    ]);
    exit;
}

// ── Verificar existencia del usuario ────────────────────────
try {
    $stmtU = $pdo->prepare('SELECT id FROM usuarios WHERE id = :id LIMIT 1');
    $stmtU->execute([':id' => $usuario_id]);
    if (!$stmtU->fetch()) {
        http_response_code(404);
        echo json_encode(['status' => 'error', 'mensaje' => 'Usuario no encontrado.']);
        exit;
    }
} catch (\PDOException $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'mensaje' => 'Error al verificar usuario: ' . $e->getMessage()]);
    exit;
}

// ── Verificar existencia del episodio ───────────────────────
try {
    $stmtE = $pdo->prepare('SELECT id FROM episodios WHERE id = :id LIMIT 1');
    $stmtE->execute([':id' => $episodio_id]);
    if (!$stmtE->fetch()) {
        http_response_code(404);
        echo json_encode(['status' => 'error', 'mensaje' => 'Episodio no encontrado.']);
        exit;
    }
} catch (\PDOException $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'mensaje' => 'Error al verificar episodio: ' . $e->getMessage()]);
    exit;
}

// ── INSERT ... ON DUPLICATE KEY UPDATE ──────────────────────
try {
    $sql = '
        INSERT INTO progreso_podcast (usuario_id, episodio_id, tiempo_segundos, ultima_escucha)
        VALUES (:usuario_id, :episodio_id, :tiempo, NOW())
        ON DUPLICATE KEY UPDATE
            tiempo_segundos = VALUES(tiempo_segundos),
            ultima_escucha  = NOW()
    ';
    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        ':usuario_id'  => $usuario_id,
        ':episodio_id' => $episodio_id,
        ':tiempo'      => $tiempo,
    ]);

    echo json_encode([
        'status'          => 'ok',
        'mensaje'         => 'Progreso guardado correctamente.',
        'tiempo_guardado' => $tiempo,
        'usuario_id'      => $usuario_id,
        'episodio_id'     => $episodio_id,
    ]);

} catch (\PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'status'  => 'error',
        'mensaje' => 'Error al guardar progreso: ' . $e->getMessage(),
    ]);
}
