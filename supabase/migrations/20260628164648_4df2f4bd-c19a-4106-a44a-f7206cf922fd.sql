INSERT INTO public.plans (id, name, price_monthly_inr, txn_fee_pct, ads_enabled, trial_days, is_recommended, features, sort_order)
VALUES ('resident', 'Resident', 50, 0, false, 0, false,
        '["Ad-free experience","Priority notifications","Visitor pre-approval","Personal cloud backup"]'::jsonb, 100)
ON CONFLICT (id) DO UPDATE
  SET name = EXCLUDED.name,
      price_monthly_inr = EXCLUDED.price_monthly_inr,
      ads_enabled = EXCLUDED.ads_enabled,
      features = EXCLUDED.features,
      sort_order = EXCLUDED.sort_order;