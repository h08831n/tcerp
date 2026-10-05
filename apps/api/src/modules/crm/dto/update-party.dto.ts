import { IsString, IsOptional, IsIn, IsBoolean, IsNumber } from 'class-validator';
import type { CustomerScoreLevel, PartyType } from '@tcerp/domain';

export class UpdatePartyDto {
  @IsOptional()
  @IsString()
  name_fa?: string;

  @IsOptional()
  @IsString()
  @IsIn(['PERSON', 'LEGAL_ENTITY'])
  party_type?: PartyType;

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
  @IsString()
  @IsIn(['BRONZE', 'SILVER', 'GOLD', 'VIP'])
  customer_score_level?: CustomerScoreLevel;

  @IsOptional()
  @IsBoolean()
  risk_flag?: boolean;

  @IsOptional()
  @IsNumber()
  operational_balance?: number;

  @IsOptional()
  @IsString()
  @IsIn(['ACTIVE', 'SUSPENDED', 'BLOCKED', 'ARCHIVED'])
  status?: string;
}

export class AddRoleDto {
  @IsString()
  @IsIn(['CUSTOMER', 'SUPPLIER', 'DRIVER', 'CARRIER', 'PROSPECT', 'BROKER', 'PARTNER'])
  role!: 'CUSTOMER' | 'SUPPLIER' | 'DRIVER' | 'CARRIER' | 'PROSPECT' | 'BROKER' | 'PARTNER';
}

export class AddPhoneDto {
  @IsString()
  @IsIn(['MOBILE', 'LANDLINE', 'FAX', 'WORK_PHONE', 'OTHER'])
  phone_type!: 'MOBILE' | 'LANDLINE' | 'FAX' | 'WORK_PHONE' | 'OTHER';

  @IsString()
  raw_number!: string;

  @IsOptional()
  @IsBoolean()
  is_primary?: boolean;
}

export class AddContactDto {
  @IsString()
  full_name!: string;

  @IsOptional()
  @IsString()
  position?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  raw_number?: string;

  @IsOptional()
  phones?: any[];

  @IsOptional()
  @IsBoolean()
  is_primary?: boolean;
}

export class AddAddressDto {
  @IsString()
  @IsIn(['MAIN', 'BILLING', 'SHIPPING', 'UNLOADING', 'OFFICE', 'WAREHOUSE', 'HEADQUARTERS', 'FACTORY', 'BRANCH', 'OTHER'])
  address_type!: string;

  @IsString()
  province!: string;

  @IsString()
  city!: string;

  @IsString()
  address_line!: string;

  @IsOptional()
  @IsString()
  postal_code?: string;

  @IsOptional()
  @IsBoolean()
  is_default?: boolean;
}
