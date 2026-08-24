<?php
header("Content-Type: application/json; charset=utf-8");
header("Cache-Control: no-store");

$STORE = __DIR__ . "/data/lists.json";
$ADMIN_USER = "hoopeystar";
$ADMIN_PIN = "1432";
$SALT = "ll26-hoopey";

function respond($code, $payload) {
  http_response_code($code);
  echo json_encode($payload);
  exit;
}

function pid($name) {
  return strtolower(trim((string)$name));
}

function pin_hash($user, $pin) {
  global $SALT;
  return hash("sha256", pid($user) . ":" . $pin . ":" . $SALT);
}

function public_people($data) {
  $out = array();
  foreach ($data["users"] as $key => $u) {
    $out[] = array(
      "id" => $u["id"],
      "name" => $u["name"],
      "picks" => isset($u["picks"]) ? $u["picks"] : new stdClass(),
      "notes" => isset($u["notes"]) ? $u["notes"] : new stdClass(),
      "updatedAt" => isset($u["updatedAt"]) ? $u["updatedAt"] : ""
    );
  }
  return $out;
}

function load_store($path) {
  if (!file_exists($path)) {
    return array("users" => array());
  }
  $raw = file_get_contents($path);
  $data = json_decode($raw, true);
  if (!is_array($data) || !isset($data["users"]) || !is_array($data["users"])) {
    return array("users" => array());
  }
  return $data;
}

function save_store($path, $data) {
  $dir = dirname($path);
  if (!is_dir($dir)) mkdir($dir, 0755, true);
  $tmp = $path . ".tmp";
  $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
  file_put_contents($tmp, $json, LOCK_EX);
  rename($tmp, $path);
}

function new_id() {
  return "p" . bin2hex(random_bytes(6));
}

$raw = file_get_contents("php://input");
$body = json_decode($raw, true);
if (!is_array($body)) $body = $_GET;
$action = isset($body["action"]) ? $body["action"] : (isset($_GET["action"]) ? $_GET["action"] : "lists");

$fp = fopen($STORE, "c+");
if (!$fp) respond(500, array("ok" => false, "error" => "Could not open list store."));
flock($fp, LOCK_EX);
$data = load_store($STORE);

if ($action === "lists") {
  flock($fp, LOCK_UN);
  fclose($fp);
  respond(200, array("ok" => true, "people" => public_people($data)));
}

$user = isset($body["username"]) ? trim((string)$body["username"]) : "";
$pin = isset($body["pin"]) ? preg_replace("/\D/", "", (string)$body["pin"]) : "";
$key = pid($user);

if ($action === "login") {
  if ($user === "" || strlen($pin) !== 4) {
    flock($fp, LOCK_UN); fclose($fp);
    respond(400, array("ok" => false, "error" => "Enter a username and a 4-digit PIN"));
  }
  if ($key === $ADMIN_USER) {
    flock($fp, LOCK_UN); fclose($fp);
    if ($pin !== $ADMIN_PIN) respond(403, array("ok" => false, "error" => "Wrong PIN"));
    respond(200, array("ok" => true, "admin" => true, "people" => public_people($data)));
  }
  if (!isset($data["users"][$key])) {
    $row = array(
      "id" => new_id(),
      "name" => $user,
      "pinHash" => pin_hash($user, $pin),
      "picks" => new stdClass(),
      "notes" => new stdClass(),
      "updatedAt" => gmdate("c")
    );
    $data["users"][$key] = $row;
    save_store($STORE, $data);
    flock($fp, LOCK_UN); fclose($fp);
    respond(200, array(
      "ok" => true,
      "created" => true,
      "user" => array("id" => $row["id"], "name" => $row["name"], "picks" => new stdClass(), "notes" => new stdClass()),
      "people" => public_people($data)
    ));
  }
  $row = $data["users"][$key];
  if (!hash_equals($row["pinHash"], pin_hash($user, $pin))) {
    flock($fp, LOCK_UN); fclose($fp);
    respond(403, array("ok" => false, "error" => "Wrong PIN"));
  }
  flock($fp, LOCK_UN); fclose($fp);
  respond(200, array(
    "ok" => true,
    "created" => false,
    "user" => array(
      "id" => $row["id"],
      "name" => $row["name"],
      "picks" => $row["picks"],
      "notes" => $row["notes"]
    ),
    "people" => public_people($data)
  ));
}

if ($action === "save") {
  if ($key === $ADMIN_USER) {
    flock($fp, LOCK_UN); fclose($fp);
    respond(400, array("ok" => false, "error" => "Admin has no list to save"));
  }
  if (!isset($data["users"][$key])) {
    flock($fp, LOCK_UN); fclose($fp);
    respond(404, array("ok" => false, "error" => "Unknown username"));
  }
  $row = $data["users"][$key];
  if (!hash_equals($row["pinHash"], pin_hash($user, $pin))) {
    flock($fp, LOCK_UN); fclose($fp);
    respond(403, array("ok" => false, "error" => "Wrong PIN"));
  }
  $picks = isset($body["picks"]) && is_array($body["picks"]) ? $body["picks"] : array();
  $notes = isset($body["notes"]) && is_array($body["notes"]) ? $body["notes"] : array();
  $data["users"][$key]["picks"] = $picks;
  $data["users"][$key]["notes"] = $notes;
  $data["users"][$key]["updatedAt"] = gmdate("c");
  save_store($STORE, $data);
  flock($fp, LOCK_UN); fclose($fp);
  respond(200, array("ok" => true, "people" => public_people($data)));
}

if ($action === "delete" || $action === "deleteAll") {
  if ($key !== $ADMIN_USER || $pin !== $ADMIN_PIN) {
    flock($fp, LOCK_UN); fclose($fp);
    respond(403, array("ok" => false, "error" => "Admin only"));
  }
  if ($action === "deleteAll") {
    $data["users"] = array();
  } else {
    $target = isset($body["id"]) ? (string)$body["id"] : "";
    $targetName = isset($body["target"]) ? pid($body["target"]) : "";
    foreach ($data["users"] as $k => $u) {
      if ($u["id"] === $target || $k === $targetName) {
        unset($data["users"][$k]);
        break;
      }
    }
  }
  save_store($STORE, $data);
  flock($fp, LOCK_UN); fclose($fp);
  respond(200, array("ok" => true, "people" => public_people($data)));
}

flock($fp, LOCK_UN);
fclose($fp);
respond(400, array("ok" => false, "error" => "Unknown action"));
