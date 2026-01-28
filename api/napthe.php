<?php
$data=json_decode(file_get_contents("php://input"),true);

$partner_id="ID_CUA_BAN";
$partner_key="KEY_CUA_BAN";

$post=[
"telco"=>$data['telco'],
"code"=>$data['code'],
"serial"=>$data['serial'],
"amount"=>$data['amount'],
"request_id"=>$data['user']."_".time(),
"partner_id"=>$partner_id,
"sign"=>md5($partner_key.$data['code'].$data['serial'])
];

$ch=curl_init("https://thesieure.com/chargingws/v2");
curl_setopt($ch,CURLOPT_RETURNTRANSFER,true);
curl_setopt($ch,CURLOPT_POSTFIELDS,http_build_query($post));
$res=curl_exec($ch);
curl_close($ch);

echo json_encode(["status"=>"success"]);
