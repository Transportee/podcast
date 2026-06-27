-- ============================================================
-- PODCAST PLAYER - MINECRAFT EDITION
-- Base de datos: podcast
-- Charset: utf8mb4
-- ============================================================

CREATE DATABASE IF NOT EXISTS `podcast`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE `podcast`;

-- ------------------------------------------------------------
-- Tabla: usuarios
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `usuarios` (
  `id`     INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `nombre` VARCHAR(100) NOT NULL,
  `email`  VARCHAR(180) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Tabla: episodios
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `episodios` (
  `id`                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `titulo`            VARCHAR(255) NOT NULL,
  `artista`           VARCHAR(255) NOT NULL DEFAULT '',
  `url_audio`         TEXT         NOT NULL,
  `duracion_segundos` INT UNSIGNED NOT NULL DEFAULT 0,
  `color_disco`       VARCHAR(7)   NOT NULL DEFAULT '#C0392B',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Tabla: progreso_podcast
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `progreso_podcast` (
  `id`              INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  `usuario_id`      INT UNSIGNED     NOT NULL,
  `episodio_id`     INT UNSIGNED     NOT NULL,
  `tiempo_segundos` FLOAT            NOT NULL DEFAULT 0,
  `ultima_escucha`  DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_usuario_episodio` (`usuario_id`, `episodio_id`),
  CONSTRAINT `fk_progreso_usuario`  FOREIGN KEY (`usuario_id`)  REFERENCES `usuarios` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_progreso_episodio` FOREIGN KEY (`episodio_id`) REFERENCES `episodios` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Datos de prueba: usuarios
-- ------------------------------------------------------------
INSERT INTO `usuarios` (`nombre`, `email`) VALUES
  ('Steve',    'steve@minecraft.net'),
  ('Alex',     'alex@minecraft.net'),
  ('Enderman', 'enderman@minecraft.net');

-- ------------------------------------------------------------
-- Datos de prueba: episodios
-- Nota: Las URLs apuntan a streams públicos de ejemplo.
--       Reemplaza url_audio con tus propios archivos .mp3
--       para producción.
-- ------------------------------------------------------------
INSERT INTO `episodios` (`titulo`, `artista`, `url_audio`, `duracion_segundos`, `color_disco`) VALUES
  (
    'LIKEY',
    'TWICE',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    210,
    '#FF6B9D'
  ),
  (
    'Dance The Night Away',
    'TWICE',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    195,
    '#FFD93D'
  ),
  (
    'What Is Love?',
    'TWICE',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
    222,
    '#FF6B6B'
  ),
  (
    'One, Two, Three, GO!',
    'Belanova',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
    238,
    '#6BCB77'
  ),
  (
    'Puro Talento',
    'Miranda!',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
    201,
    '#4D96FF'
  );

-- ------------------------------------------------------------
-- Progreso inicial (usuario 1 escuchó parcialmente los eps)
-- ------------------------------------------------------------
INSERT INTO `progreso_podcast` (`usuario_id`, `episodio_id`, `tiempo_segundos`) VALUES
  (1, 1, 47.5),
  (1, 2, 12.0),
  (2, 3, 98.3);
