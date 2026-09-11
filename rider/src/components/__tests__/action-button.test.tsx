import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ActionButton } from '../action-button';

describe('ActionButton', () => {
  it('renders the label', () => {
    render(<ActionButton label="Test Button" onPress={() => {}} />);
    expect(screen.getByText('Test Button')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const onPressMock = jest.fn();
    render(<ActionButton label="Press Me" onPress={onPressMock} />);
    fireEvent.press(screen.getByRole('button'));
    expect(onPressMock).toHaveBeenCalledTimes(1);
  });

  it('does not call onPress when disabled', () => {
    const onPressMock = jest.fn();
    render(
      <ActionButton label="Disabled Button" onPress={onPressMock} disabled />,
    );
    fireEvent.press(screen.getByRole('button'));
    expect(onPressMock).not.toHaveBeenCalled();
  });
});
