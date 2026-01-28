<?php
$data = json_decode(file_get_contents("php://input"), true);

$partner_id  = "ID_THESIEURE";
$partner_key = "KEY_THESIEURE";

$payload = [
 "request_id" => time(),
 "code"       => $data['code'],
 "partner_id" => $partner_id,
 "serial"     => $data['serial'],
 "telco"      => $data['telco'],
 "command"    => "charging",
 "amount"     => $data['amount'],
 "sign" => md5($partner_key.time().$data['code'].$data['serial'])
];

$ch = curl_init("https://thesieure.com/chargingws/v2");
curl_setopt($ch,CURLOPT_RETURNTRANSFER,true);
curl_setopt($ch,CURLOPT_POST,true);
curl_setopt($ch,CURLOPT_POSTFIELDS,http_build_query($payload));
$res = json_decode(curl_exec($ch),true);

if($res['status']==1){
 echo json_encode(["status"=>"success","amount"=>$data['amount']]);
}else{
 echo json_encode(["status"=>"error","msg"=>$res['message']]);
}
