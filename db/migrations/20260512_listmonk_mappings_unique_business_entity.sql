CREATE UNIQUE INDEX IF NOT EXISTS listmonk_mappings_business_entity_idx
    ON listmonk_mappings (client_id, entity_type, entity_id, listmonk_type);
