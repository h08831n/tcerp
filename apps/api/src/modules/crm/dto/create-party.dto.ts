import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
  IsArray,
  ValidateNested,
  IsBoolean,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { PartyRoleType, PartyType, PhoneType, AddressType } from '@tcerp/domain';

export class PhoneInputDto {
  @IsString()
  @IsIn(['MOBILE', 'LANDLINE', 'FAX', 'WORK_PHONE', 'OTHER'])
  phone_type!: PhoneType;

  @IsString()
  @IsNotEmpty({ message: 'شماره تماس نمی‌تواند خالی باشد.' })
  raw_number!: string;

  @IsOptional()
  @IsBoolean()
  is_primary?: boolean;
}

export class AddressInputDto {
  @IsString()
  @IsIn(['MAIN', 'BILLING', 'SHIPPING', 'UNLOADING', 'OFFICE', 'WAREHOUSE', 'HEADQUARTERS', 'FACTORY', 'BRANCH', 'OTHER'])
  address_type!: AddressType;

  @IsString()
  @IsNotEmpty()
  province!: string;

  @IsString()
  @IsNotEmpty()
  city!: string;

  @IsString()
  @IsNotEmpty()
  address_line!: string;

  @IsOptional()
  @IsString()
  postal_code?: string;

  @IsOptional()
  @IsBoolean()
  is_default?: boolean;
}

export class ContactInputDto {
  @IsString()
  @IsNotEmpty()
  full_name!: string;

  @IsOptional()
  @IsString()
  position?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsBoolean()
  is_primary?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PhoneInputDto)
  phones?: PhoneInputDto[];
}

export class CreatePartyDto {
  @IsString()
  @IsNotEmpty({ message: 'نام طرف‌حساب الزامی است.' })
  @MinLength(2, { message: 'نام طرف‌حساب باید حداقل ۲ کاراکتر باشد.' })
  name_fa!: string;

  @IsString()
  @IsIn(['PERSON', 'COMPANY', 'LEGAL_ENTITY'], { message: 'نوع طرف‌حساب باید حقیقی (PERSON) یا حقوقی (COMPANY) باشد.' })
  party_type!: PartyType;

  @IsOptional()
  @IsString()
  name_en?: string;

  @IsOptional()
  @IsString()
  national_id?: string;

  @IsOptional()
  @IsString()
  economic_code?: string;

  @IsOptional()
  @IsString()
  registration_number?: string;

  @IsOptional()
  @IsString()
  postal_code?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  assigned_salesperson_id?: string;

  @IsOptional()
  @IsArray()
  roles?: PartyRoleType[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PhoneInputDto)
  phones?: PhoneInputDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddressInputDto)
  addresses?: AddressInputDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContactInputDto)
  contacts?: ContactInputDto[];
}
