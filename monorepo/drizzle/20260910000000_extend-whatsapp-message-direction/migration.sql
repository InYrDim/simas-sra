ALTER TABLE `whatsapp_bot_message`
	MODIFY `direction` ENUM('inbound', 'outbound') NOT NULL DEFAULT 'inbound',
	ADD `sent_at` timestamp(3),
	ADD `delivery_status` varchar(32);