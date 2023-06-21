```
LIP: <LIP number>
Title: Add 256-bit Integer Types to Lisk Codec
Author: Andreas Kendziorra <andreas.kendziorra@lightcurve.io>
? Discussions-To: <Link to discussion in Lisk Research>
Type: Standards Track
Created: <YYYY-MM-DD>
Updated: <YYYY-MM-DD>
```

## Abstract

We propose to add support for 256-bit integers in Lisk codec - the serialization method introduced in LIP 0027 - for both signed and unsigned integers. Unsigned integers will be encoded using big-endian encoding. Signed integers will be encoded using the two's complement representation.

## Copyright

This LIP is licensed under the [Creative Commons Zero 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/).

## Motivation

Lisk codec, the serialization method proposed in [LIP 0027](https://github.com/LiskHQ/lips/blob/main/proposals/lip-0027.md), allows integer types using 32 bits or 64 bits, but no larger integer types. In the future, there may very well be some use cases that require integers exceeding the range of 64-bit integers. Projects building bridges to Ethereum, for instance, will most likely require the support of 256-bit unsigned integers as it is a commonly used data type in Ethereum. For these reasons, we propose to add support for signed and unsigned 256-bit integers to Lisk codec.

## Specification

The following two values are added for the [dataType](https://github.com/LiskHQ/lips/blob/main/proposals/lip-0027.md#datatype-keyword) keyword: _uint256_ and _int256_. Properties of those types are validated as in the following table.

<table>
  <tr>
   <td><strong>If data is of "dataType"</strong>
   </td>
   <td><strong>JavaScript validation</strong>
   </td>
  </tr>
  <tr>
   <td>uint256
   </td>
   <td>

```js
typeof data === "bigint" &&
0n <= data < 2n ** 256n;
```

   </td>
  </tr>
  <tr>
   <td>int256
   </td>
   <td>

```js
typeof data === "bigint" &&
-(2n ** 255n) <= data < 2n ** 255n;
```

   </td>
  </tr>
</table>

### Encoding

#### uint256

Values of data type _uint256_ are encoded using big-endian encoding with a fixed length of 32 bytes. This sequence of 32 bytes is then encoded like a [value of bytes](https://github.com/LiskHQ/lips/blob/main/proposals/lip-0027.md#encoding-strings-and-bytes). In particular, the key is of [wire type](https://github.com/LiskHQ/lips/blob/main/proposals/lip-0027.md#keys) 2.

#### int256

Values of data type _int256_ are encoded by taking the big-endian encoding of their [two’s complement](https://en.wikipedia.org/wiki/Two%27s_complement) representation using a fixed length of 32 bytes. The two's complement representation means that non-negative values are encoded in their byte representation, and negative integers are encoded by taking the two’s complement of the magnitude. The two’s complement of the magnitude means that the 256-bit representation of the magnitude is flipped (bitwise NOT), and then 1 is added to the result. In particular, the most significant bit of the encoded value is one if and only if the integer is negative.

As for _uint256_, the sequence of 32 bytes is then encoded like a [value of bytes](https://github.com/LiskHQ/lips/blob/main/proposals/lip-0027.md#encoding-strings-and-bytes). In particular, the key is of [wire type](https://github.com/LiskHQ/lips/blob/main/proposals/lip-0027.md#keys) 2.

### Type Conversion to Protobuf

When [converting a Lisk JSON schema to a .proto file](https://github.com/LiskHQ/lips/blob/main/proposals/lip-0027.md#appendix-b-json-schema-to-protobuf), properties of data type _uint256_ or _int256_ in the Lisk JSON schema are converted to fields of type _bytes_ in the `.proto` file.

## Rationale

### Why Byte Representation Instead of Varint?

Using varint encoding would break the compatibility with protobuf heavily. Recall that Lisk codec was designed in a way that [every Lisk JSON schema can be converted to a .proto file](https://github.com/LiskHQ/lips/blob/main/proposals/lip-0027.md#appendix-b-json-schema-to-protobuf) and that every protobuf decoder decodes binary messages in the same way as Lisk codec using this `.proto` file. Using varint encoding would result in encoded values up to 37 bytes, because varint encoding puts 7 bits of the number into a byte. Hence, ⌈256/7⌉ bytes are required to encode a 256-bit integer. There is, however, no field type in protobuf to which a protobuf decoder could decode a varint encoded value of more than 10 bytes. This is because the [supported number types](https://protobuf.dev/programming-guides/proto2/#scalar) do not use more than 64 bits. Hence, one could not convert a Lisk JSON schema that uses _uint256_ or _int256_ to a `.proto` file that could be used by a protobuf decoder for the same binary messages.

Using the same encoding as for the data type _bytes_ for _uint256_ and _int256_ allows a protobuf decoder to still decode a binary message. However, the encoded 256-bit integer is only treated like a _bytes_ value. If the encoded value is supposed to be treated or interpreted as a 256-bit integer, some additional steps are required. Note that protobuf is not directly supporting 256-bit integer types as most programming languages do not support them.

## Backwards Compatibility

This proposal does NOT imply any incompatibilities. That means, nodes could update their software to be compatible with this proposal without experiencing any incompatibilities. In particular, encoding and decoding rules for [Lisk JSON schemas as defined in LIP 0027](https://github.com/LiskHQ/lips/blob/main/proposals/lip-0027.md#lisk-json-schemas) do not change.

If, however, some new schemas using _uint256_ or _int256_ are added to the protocol of a chain, then this implies a hard fork as nodes following the old protocol won’t be able to serialize or deserialize the corresponding messages. But this incompatibility and hard fork is already implied by the addition of the new schemas, and in fact, would also be implied if the new schemas do neither use _uint256_ nor _int256_.

These compatibility statements hold for any chain, including the Lisk Mainchain.

## Reference Implementation

TBD

## Appendix

### Examples

#### Encoding

<table>
  <tr>
   <td><strong>Lisk JSON schema</strong>
   </td>
   <td><strong>Object instance</strong>
   </td>
   <td><strong>binary message</strong>
   </td>
  </tr>
  <tr>
   <td>

```json
{
  "type": "object",
  "required": ["foo"],
  "properties": {
    "foo": {
      "dataType": "uint256",
      "fieldNumber": 1
    }
  }
}
```

   </td>
   <td>

```js
{ "foo": 43n }
```

   </td>
   <td>

```
0a200000
00000000
00000000
00000000
00000000
00000000
00000000
00000000
002b
```

   </td>
  </tr>
  <tr>
   <td rowspan="2" >

```json
{
  "type": "object",
  "required": ["foo"],
  "properties": {
    "foo": {
      "dataType": "int256",
      "fieldNumber": 1
    }
  }
}

````
   </td>
   <td>

```js
{ "foo": 43n }
````

   </td>
   <td>

```
0a200000
00000000
00000000
00000000
00000000
00000000
00000000
00000000
002b
```

   </td>
  </tr>
  <tr>
   <td>

```js
{ "foo": -43n }
```
   </td>
   <td>

```
0a20ffff
ffffffff
ffffffff
ffffffff
ffffffff
ffffffff
ffffffff
ffffffff
ffd5
```

   </td>
  </tr>
</table>
