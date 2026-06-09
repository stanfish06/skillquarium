SELECT
  corpus,
  word,
  word_count
FROM `bigquery-public-data.samples.shakespeare`
ORDER BY word_count DESC
LIMIT 5
