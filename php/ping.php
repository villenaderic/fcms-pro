<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
echo json_encode([
  'ok'      => true,
  'app'     => 'FCMS Pro v4',
  'php'     => PHP_VERSION,
  'time'    => date('c'),
  'message' => 'PHP backend is online'
]);
