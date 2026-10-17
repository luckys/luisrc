DROP SCHEMA IF EXISTS db_migration CASCADE;
CREATE SCHEMA db_migration;
CREATE TABLE db_migration.profiles (id integer PRIMARY KEY, name text NOT NULL);
INSERT INTO db_migration.profiles VALUES (1,'Ana');
-- Expand: sigue funcionando el INSERT de la versión antigua.
ALTER TABLE db_migration.profiles ADD COLUMN display_name text;
INSERT INTO db_migration.profiles(id,name) VALUES (2,'Luis');
-- Dual write: la aplicación nueva aún escribe ambas columnas.
UPDATE db_migration.profiles SET display_name=name WHERE display_name IS NULL;
-- Cierre de la ventana: todos los escritores antiguos ya se retiraron.
ALTER TABLE db_migration.profiles ADD CONSTRAINT display_name_present
  CHECK (display_name IS NOT NULL) NOT VALID;
ALTER TABLE db_migration.profiles VALIDATE CONSTRAINT display_name_present;
ALTER TABLE db_migration.profiles ALTER COLUMN display_name SET NOT NULL;
ALTER TABLE db_migration.profiles DROP CONSTRAINT display_name_present;
-- Contract: solo tras verificar que ninguna versión lee name.
ALTER TABLE db_migration.profiles DROP COLUMN name;
SELECT * FROM db_migration.profiles ORDER BY id;
