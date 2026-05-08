import { Injectable, NotFoundException } from '@nestjs/common';
import { EnumUserRole } from './enums/user.roles';
import { CreateUserDto } from './dtos/create.user.dto';
import { UpdateUserDto } from './dtos/update.user.dto';

@Injectable()
export class UsersService {
  private users = [
    {
      id: 1,
      name: 'John Doe',
      email: 'john.doe@example.com',
      role: 'INTERN',
    },
    {
      id: 2,
      name: 'Jane Doe',
      email: 'jane.doe@example.com',
      role: 'ENGINEER',
    },
    {
      id: 3,
      name: 'Bob Doe',
      email: 'bob.doe@example.com',
      role: 'ADMIN',
    },
  ];

  findAll(role?: EnumUserRole) {
    if (role) {
      return this.users.filter((user) => user.role === role);
    }
    return this.users;
  }

  findOne(id: number) {
    const foundUser = this.users.find((user) => user.id === id);

    if (!foundUser) {
      throw new NotFoundException(`User with id ${id} not found`);
    }

    return foundUser;
  }

  create(user: CreateUserDto) {
    const newUser = {
      id: this.users.length + 1,
      ...user,
    };
    this.users.push(newUser);
    return newUser;
  }

  update(id: number, toBeUpdatedUser: UpdateUserDto) {
    this.users = this.users.map((user) => {
      if (user.id === id) {
        user.name = toBeUpdatedUser.name || user.name;
        user.email = toBeUpdatedUser.email || user.email;
        user.role = toBeUpdatedUser.role || user.role;
      }
      return user;
    });

    return this.findOne(id);
  }

  delete(id: number) {
    const removedUser = this.findOne(id);
    this.users = this.users.filter((user) => user.id !== id);
    return removedUser;
  }
}
