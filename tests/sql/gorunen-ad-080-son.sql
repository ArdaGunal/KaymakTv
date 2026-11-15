-- 080 yerel sınamasının sonuç bölümü (bkz. gorunen-ad-080.sql).
SELECT CASE WHEN gecti THEN 'TAMAM ' ELSE 'KALDI ' END || ad FROM sonuc;
SELECT 'OZET ' || count(*) FILTER (WHERE gecti) || ' gecti / ' || count(*) FILTER (WHERE NOT gecti OR gecti IS NULL) || ' kaldi' FROM sonuc;
