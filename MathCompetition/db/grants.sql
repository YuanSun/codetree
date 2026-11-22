-- Re-run by `python3 userctl.py migrate` every time (safe to repeat), as the admin role.
-- Gives mathlab_app its rights, and lets it READ the family profiles in lecture.app_user (to check a
-- sign-in): only the five columns it needs, no write access, nothing else in the lecture schema.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mathlab_app') THEN
    GRANT USAGE ON SCHEMA mathlab TO mathlab_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA mathlab TO mathlab_app;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA mathlab TO mathlab_app;
    IF to_regclass('lecture.app_user') IS NOT NULL THEN
      GRANT USAGE ON SCHEMA lecture TO mathlab_app;
      GRANT SELECT (id, username, display_name, password_hash, role) ON lecture.app_user TO mathlab_app;
    END IF;
  END IF;
END $$;
