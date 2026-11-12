-- Reading progress of one child, for the parent.
--   psql -d postgres -v kid=grace -f tools/progress.sql
-- (read-only: SELECT statements only)
\pset footer off
\echo
\echo '== Mots difficiles (erreurs au défi, oublis, nombre de fois cherché) =='
SELECT l.lemma AS mot, w.lookup_count AS cherche, w.lapses AS oublis, w.familiarity AS niveau,
       count(qi.id) FILTER (WHERE qi.correct IS FALSE AND NOT coalesce((qi.prompt->>'retry')::boolean, false)) AS erreurs_defi,
       (SELECT gloss_en FROM lecture.sense s WHERE s.lemma_id = l.id AND s.source = 'wiktionary_en' ORDER BY s.seq LIMIT 1) AS english,
       to_char(w.first_seen_at, 'YYYY-MM-DD') AS depuis
FROM lecture.user_word w
JOIN lecture.lemma l ON l.id = w.lemma_id
JOIN lecture.app_user u ON u.id = w.user_id
LEFT JOIN lecture.quiz q ON q.user_id = w.user_id
LEFT JOIN lecture.quiz_item qi ON qi.quiz_id = q.id AND qi.lemma_id = w.lemma_id
WHERE u.username = :'kid' AND w.status <> 'known'
GROUP BY l.id, l.lemma, w.lookup_count, w.lapses, w.familiarity, w.first_seen_at
ORDER BY erreurs_defi DESC, oublis DESC, cherche DESC
LIMIT 30;

\echo '== Mots touchés par semaine =='
SELECT to_char(date_trunc('week', e.created_at), 'YYYY-MM-DD') AS semaine, count(*) AS mots_touches,
       count(DISTINCT e.lemma_id) AS mots_differents,
       count(*) FILTER (WHERE e.self_rating = 'unknown') AS pas_connus
FROM lecture.lookup_event e JOIN lecture.app_user u ON u.id = e.user_id
WHERE u.username = :'kid' GROUP BY 1 ORDER BY 1 DESC LIMIT 12;

\echo '== Défis de la semaine =='
SELECT q.week_of AS semaine, q.status AS etat,
       count(*) FILTER (WHERE NOT coalesce((i.prompt->>'retry')::boolean, false)) AS questions,
       count(*) FILTER (WHERE i.correct AND NOT coalesce((i.prompt->>'retry')::boolean, false)) AS justes_du_premier_coup
FROM lecture.quiz q JOIN lecture.app_user u ON u.id = q.user_id JOIN lecture.quiz_item i ON i.quiz_id = q.id
WHERE u.username = :'kid' GROUP BY q.id, q.week_of, q.status ORDER BY q.week_of DESC LIMIT 12;

\echo '== Lectures =='
SELECT a.title AS livre, array_length(p.chapters_done, 1) AS chapitres_finis,
       (SELECT count(*) FROM lecture.chapter c WHERE c.article_id = a.id) AS chapitres,
       round(p.seconds_read / 60.0) AS minutes_total, p.finished_at IS NOT NULL AS termine
FROM lecture.reading_progress p JOIN lecture.article a ON a.id = p.article_id
JOIN lecture.app_user u ON u.id = p.user_id
WHERE u.username = :'kid' ORDER BY p.started_at DESC;

\echo '== Sac à mots =='
SELECT count(*) FILTER (WHERE status = 'learning' AND familiarity = 0) AS nouveaux,
       count(*) FILTER (WHERE status = 'learning' AND familiarity BETWEEN 1 AND 4) AS en_cours,
       count(*) FILTER (WHERE familiarity = 5) AS en_or,
       count(*) FILTER (WHERE status = 'known') AS deja_connus
FROM lecture.user_word w JOIN lecture.app_user u ON u.id = w.user_id WHERE u.username = :'kid';
