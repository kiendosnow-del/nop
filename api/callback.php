<?php
$user=explode("_",$_POST['request_id'])[0];
$amount=$_POST['value'];
$status=$_POST['status'];

if($status==1){
$file="../wallet.json";
$wallet=json_decode(file_get_contents($file),true);
$wallet[$user]+= $amount;
file_put_contents($file,json_encode($wallet));
}
