import { describe, expect, it } from '@jest/globals';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateClientDto } from './create-client.dto.js';

const validClient = {
  name: 'Acme Ltd',
  email: 'contact@acme.example',
  phone: '+1-555-0100',
};

async function invalidFields(plain: object): Promise<string[]> {
  const errors = await validate(plainToInstance(CreateClientDto, plain));
  return errors.map((error) => error.property);
}

describe('CreateClientDto', () => {
  it('accepts a client without document', async () => {
    expect(await invalidFields(validClient)).toEqual([]);
  });

  it.each(['email', 'phone'])('requires %s', async (field) => {
    const { [field as keyof typeof validClient]: _removed, ...rest } =
      validClient;
    expect(await invalidFields(rest)).toEqual([field]);
  });

  it.each(['name', 'email', 'phone', 'document'])(
    'rejects null in %s',
    async (field) => {
      expect(await invalidFields({ ...validClient, [field]: null })).toEqual([
        field,
      ]);
    },
  );
});
