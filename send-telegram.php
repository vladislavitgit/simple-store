<?php
ini_set('display_errors', '0');
ini_set('log_errors', '1');
header('Content-Type: application/json; charset=utf-8');

function respond(int $status, array $data): void {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');
    respond(405, ['ok' => false, 'description' => 'Используйте форму для отправки заявки.']);
}

if (!is_file(__DIR__ . '/telegram-config.local.php')) {
    respond(500, ['ok' => false, 'description' => 'Отправка заявок временно недоступна.']);
}
require __DIR__ . '/telegram-config.local.php';

$name = is_string($_POST['name'] ?? null) ? trim($_POST['name']) : '';
$phone = is_string($_POST['phone'] ?? null) ? trim($_POST['phone']) : '';
$item = is_string($_POST['item'] ?? null) ? trim($_POST['item']) : '';
if ($name === '' || $phone === '' || strlen($name) > 400 || strlen($item) > 800) {
    respond(400, [
        'ok' => false,
        'description' => 'Заполните все поля.'
    ]);
}
if (!preg_match('/^\+7 \([0-9]{3}\) [0-9]{3}-[0-9]{2}-[0-9]{2}$/', $phone)) {
    respond(400, ['ok' => false, 'description' => 'Укажите номер в формате +7 (999) 123-45-67.']);
}
if (!isset($token) || !is_string($token) || $token === '' || $chatId === '') {
    respond(500, ['ok' => false, 'description' => 'Отправка заявок временно недоступна.']);
}
$message = "Новая заявка на запись!\n\n";
$message .= "Имя: " . $name . "\n";
$message .= "Телефон: " . $phone;
if ($item !== '') $message .= "\nИнтересует: " . $item;
$url = "https://api.telegram.org/bot{$token}/sendMessage";
$data = [
    'chat_id' => $chatId,
    'text' => $message
];
$ch = curl_init($url);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $data);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
curl_setopt($ch, CURLOPT_TIMEOUT, 20);
$response = curl_exec($ch);
if ($response === false) {
    respond(502, [
        'ok' => false,
        'description' => 'Не удалось подтвердить отправку.
        Свяжитесь с нами перед повторной отправкой заявки.'
    ]);
}
$httpStatus = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
$result = json_decode($response, true);
if (!is_array($result) || !isset($result['ok']) || !is_bool($result['ok'])) {
    respond(502, ['ok' => false, 'description' => 'Не удалось подтвердить отправку.
    Свяжитесь с нами перед повторной отправкой заявки.']);
}
if ($httpStatus < 200 || $httpStatus >= 300 || $result['ok'] !== true) {
    respond(502, ['ok' => false, 'description' => 'Не удалось отправить заявку. Свяжитесь с нами.']);
}
respond(200, ['ok' => true]);
